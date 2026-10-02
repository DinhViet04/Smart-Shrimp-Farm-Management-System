import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateShrimpHealthDto } from './dto/create-shrimp-health.dto.js';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationLevel } from '@prisma/client';

@Injectable()
export class ShrimpHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────────────────

  async create(user: AuthUser, dto: CreateShrimpHealthDto) {
    // 1. Validate record time is not in the future
    const recordTime = new Date(dto.recordTime);
    if (recordTime > new Date()) {
      throw new BadRequestException(
        'Thời gian ghi nhận không được ở tương lai',
      );
    }

    // 2. Validate farm exists, pond, crop and user has access
    // Tối ưu DB: Query đồng thời bằng Promise.all
    const [farm, pond, crop, technician] = await Promise.all([
      this.prisma.farm.findUnique({
        where: { id: dto.farmId, deletedAt: null },
      }),
      this.prisma.pond.findUnique({
        where: { id: dto.pondId },
      }),
      this.prisma.crop.findUnique({
        where: { id: dto.cropId },
      }),
      this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { fullName: true },
      }),
    ]);

    if (!farm) {
      throw new NotFoundException('Không tìm thấy trang trại');
    }
    await this.farmAccess.assertCanAccessFarm(user, dto.farmId);

    // 3. Validate pond belongs to farm
    if (!pond || pond.farmId !== dto.farmId) {
      throw new BadRequestException('Ao nuôi không thuộc trang trại đã chọn');
    }

    // 4. Validate crop belongs to pond and is ACTIVE
    if (!crop || crop.pondId !== dto.pondId) {
      throw new BadRequestException('Vụ nuôi không thuộc ao nuôi đã chọn');
    }
    if (crop.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Chỉ được ghi nhận cho vụ nuôi đang hoạt động',
      );
    }

    // 5. Create the record
    const record = await this.prisma.shrimpHealthRecord.create({
      data: {
        farmId: dto.farmId,
        pondId: dto.pondId,
        cropId: dto.cropId,
        recordedBy: user.userId,
        recordTime,
        healthStatus: dto.healthStatus as any,
        severity: dto.severity as any,
        affectedPercentage: dto.affectedPercentage,
        note: dto.note ?? null,
      },
    });

    // 6. TỐI ƯU HIỆU NĂNG: Gửi thông báo realtime bất đồng bộ (fire-and-forget)
    // Giúp API response trả về tức thì cho KTV mà không bị nghẽn
    this.dispatchShrimpHealthNotification(
      farm,
      pond,
      technician?.fullName,
      dto,
      user.userId,
    ).catch((err) => {
      console.error(
        '[ShrimpHealthService] Lỗi gửi thông báo sức khỏe tôm:',
        err,
      );
    });

    return {
      id: record.id,
      message: 'Ghi nhận tình trạng sức khỏe tôm thành công.',
    };
  }

  /**
   * Thuật toán phân định đối tượng nhận thông báo & gửi thông báo sức khỏe tôm:
   * - Đối tượng nhận: Chủ trang trại (FARM_MANAGER) + Tất cả Nông dân (FARMER) đang hoạt động thuộc ao/trại này.
   * - Loại trừ: Kỹ thuật viên vừa nhập liệu (tránh spam chính mình).
   */
  private async dispatchShrimpHealthNotification(
    farm: { id: string; name: string; ownerId: string },
    pond: { id: string; name: string },
    technicianName: string | undefined,
    dto: CreateShrimpHealthDto,
    authorUserId: string,
  ) {
    // 1. Tìm tất cả nhân viên thuộc trang trại có role là FARMER hoặc FARM_MANAGER
    const staffMembers = await this.prisma.farmStaff.findMany({
      where: {
        farmId: farm.id,
        isActive: true,
        role: { in: ['FARMER', 'FARM_MANAGER'] },
        userId: { not: authorUserId },
      },
      select: { userId: true },
    });

    const recipientSet = new Set<string>();
    // Chủ sở hữu trang trại (FARM_MANAGER)
    if (farm.ownerId && farm.ownerId !== authorUserId) {
      recipientSet.add(farm.ownerId);
    }
    // Các nhân viên Nông dân / Quản lý
    staffMembers.forEach((s) => recipientSet.add(s.userId));

    const recipientUserIds = Array.from(recipientSet);
    if (recipientUserIds.length === 0) return;

    // 2. Map nhãn tiếng Việt
    const statusLabels: Record<string, string> = {
      NORMAL: 'Bình thường',
      LETHARGIC: 'Lờ đờ',
      EDGE_GATHERING: 'Tấp mé bờ',
      LOSS_OF_APPETITE: 'Bỏ ăn',
    };
    const severityLabels: Record<string, string> = {
      NORMAL: 'Bình thường',
      MILD: 'Nhẹ',
      MODERATE: 'Trung bình',
      SEVERE: 'Nặng',
    };

    const statusLabel = statusLabels[dto.healthStatus] || dto.healthStatus;
    const severityLabel = severityLabels[dto.severity] || dto.severity;

    // 3. Phân cấp mức độ cảnh báo theo thuật toán bệnh học thủy sản
    let level: NotificationLevel = NotificationLevel.INFO;
    let title = `Cập nhật sức khỏe tôm: ${pond.name}`;

    const isDanger =
      dto.healthStatus === 'EDGE_GATHERING' ||
      dto.healthStatus === 'LOSS_OF_APPETITE' ||
      dto.severity === 'SEVERE';

    const isWarning =
      dto.healthStatus === 'LETHARGIC' ||
      dto.severity === 'MODERATE' ||
      dto.affectedPercentage > 25;

    if (isDanger) {
      level = NotificationLevel.DANGER;
      title = `⚠️ [NGUY HIỂM] Sức khỏe tôm ${pond.name}: ${statusLabel}`;
    } else if (isWarning) {
      level = NotificationLevel.WARNING;
      title = `⚡ [CẢNH BÁO] Sức khỏe tôm ${pond.name}: ${statusLabel}`;
    }

    const techDisplayName = technicianName || 'Kỹ thuật viên';
    const noteText = dto.note ? ` Ghi chú: "${dto.note}".` : '';
    const message = `KTV ${techDisplayName} vừa kiểm tra sức khỏe tôm ao "${pond.name}": Tình trạng: ${statusLabel} (Mức độ: ${severityLabel}), Tỷ lệ ảnh hưởng: ${dto.affectedPercentage}%.${noteText} Nhấn để xem chi tiết ao.`;

    await this.notificationsService.notifyShrimpHealthUpdate({
      farmId: farm.id,
      pondId: pond.id,
      pondName: pond.name,
      farmName: farm.name || 'Trang trại',
      technicianName: techDisplayName,
      recipientUserIds,
      level,
      title,
      message,
    });

    // 4. Kiểm tra cảnh báo khẩn cấp nếu 3 lần liên tiếp bất thường
    if (isDanger) {
      await this.checkConsecutiveCriticalRecords(
        dto.pondId,
        dto.cropId,
        farm.id,
        pond.name,
        recipientUserIds,
      );
    }
  }

  // ─── History ────────────────────────────────────────────────────────────────

  async findHistory(
    user: AuthUser,
    query: {
      farmId?: string;
      pondId?: string;
      healthStatus?: string;
      fromDate?: string;
      toDate?: string;
      page?: number;
      size?: number;
      sort?: string;
    },
  ) {
    const page = query.page ?? 0;
    const size = query.size ?? 10;
    const sort = query.sort ?? 'desc';
    const { farmId, pondId, healthStatus, fromDate, toDate } = query;

    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);
    const where: any = {};

    // Filter by accessible farms
    if (pondId) {
      const pond = await this.prisma.pond.findUnique({
        where: { id: pondId },
        include: { farm: true },
      });
      if (!pond) throw new NotFoundException('Không tìm thấy ao nuôi');
      await this.farmAccess.assertCanAccessFarm(user, pond.farmId);
      where.pondId = pondId;
    } else if (farmId) {
      const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
      if (!farm) throw new NotFoundException('Không tìm thấy trang trại');
      await this.farmAccess.assertCanAccessFarm(user, farmId);
      where.farmId = farmId;
    } else if (accessibleFarmIds) {
      where.farmId = { in: accessibleFarmIds };
    }

    if (healthStatus) {
      where.healthStatus = healthStatus;
    }

    if (fromDate || toDate) {
      where.recordTime = {};
      if (fromDate) where.recordTime.gte = new Date(fromDate);
      if (toDate) where.recordTime.lte = new Date(toDate);
    }

    const skip = page * size;
    const take = size;

    const [records, totalElements] = await Promise.all([
      this.prisma.shrimpHealthRecord.findMany({
        where,
        include: {
          farm: { select: { name: true } },
          pond: { select: { name: true } },
          crop: { select: { id: true, startDate: true } },
          recorder: { select: { fullName: true } },
        },
        orderBy: { recordTime: sort === 'asc' ? 'asc' : 'desc' },
        skip,
        take,
      }),
      this.prisma.shrimpHealthRecord.count({ where }),
    ]);

    const content = records.map((r) => ({
      id: r.id,
      recordTime: r.recordTime.toISOString(),
      farmName: r.farm.name,
      pondName: r.pond.name,
      cropId: r.crop.id,
      cropStartDate: r.crop.startDate.toISOString(),
      healthStatus: r.healthStatus,
      severity: r.severity,
      affectedPercentage: r.affectedPercentage,
      note: r.note,
      recordedBy: r.recorder.fullName,
      createdAt: r.createdAt.toISOString(),
    }));

    return { content, page, size, totalElements };
  }

  // ─── Get By ID ──────────────────────────────────────────────────────────────

  async findById(user: AuthUser, id: string) {
    const record = await this.prisma.shrimpHealthRecord.findUnique({
      where: { id },
      include: {
        farm: { select: { name: true } },
        pond: { select: { name: true } },
        crop: { select: { id: true, startDate: true } },
        recorder: { select: { fullName: true } },
      },
    });

    if (!record) {
      throw new NotFoundException('Không tìm thấy bản ghi sức khỏe tôm');
    }

    await this.farmAccess.assertCanAccessFarm(user, record.farmId);

    return {
      id: record.id,
      farmId: record.farmId,
      farmName: record.farm.name,
      pondId: record.pondId,
      pondName: record.pond.name,
      cropId: record.crop.id,
      cropStartDate: record.crop.startDate.toISOString(),
      recordTime: record.recordTime.toISOString(),
      healthStatus: record.healthStatus,
      severity: record.severity,
      affectedPercentage: record.affectedPercentage,
      note: record.note,
      recordedBy: record.recorder.fullName,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Nếu 3 lần liên tiếp của ao+vụ này đều ghi nhận bất thường (tấp mé hoặc bỏ ăn),
   * lập tức gửi cảnh báo BÁO ĐỘNG ĐỎ tới Manager và Farmer
   */
  private async checkConsecutiveCriticalRecords(
    pondId: string,
    cropId: string,
    farmId: string,
    pondName: string,
    recipientUserIds: string[],
  ) {
    const lastThree = await this.prisma.shrimpHealthRecord.findMany({
      where: { pondId, cropId },
      orderBy: { recordTime: 'desc' },
      take: 3,
      select: { healthStatus: true },
    });

    if (lastThree.length < 3) return;

    const allCritical = lastThree.every(
      (r) =>
        r.healthStatus === 'EDGE_GATHERING' ||
        r.healthStatus === 'LOSS_OF_APPETITE',
    );

    if (allCritical) {
      await this.notificationsService.notifyShrimpHealthUpdate({
        farmId,
        pondId,
        pondName,
        farmName: 'Trang trại',
        technicianName: 'Hệ thống AI',
        recipientUserIds,
        level: NotificationLevel.DANGER,
        title: `🚨 [BÁO ĐỘNG ĐỎ] Ao "${pondName}" bất thường 3 lần liên tiếp!`,
        message: `Ao "${pondName}" ghi nhận liên tục 3 lần tình trạng tôm bất thường (tấp mé / bỏ ăn). Nguy cơ bùng phát dịch bệnh, cần cách ly hoặc can thiệp khẩn cấp! Nhấn để kiểm tra ngay.`,
      });
    }
  }
}
