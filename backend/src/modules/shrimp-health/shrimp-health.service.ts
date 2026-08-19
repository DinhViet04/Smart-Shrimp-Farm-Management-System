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

@Injectable()
export class ShrimpHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
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

    // 2. Validate farm exists and user has access
    const farm = await this.prisma.farm.findUnique({
      where: { id: dto.farmId, deletedAt: null },
    });
    if (!farm) {
      throw new NotFoundException('Không tìm thấy trang trại');
    }
    await this.farmAccess.assertCanAccessFarm(user, dto.farmId);

    // 3. Validate pond belongs to farm
    const pond = await this.prisma.pond.findUnique({
      where: { id: dto.pondId },
    });
    if (!pond || pond.farmId !== dto.farmId) {
      throw new BadRequestException('Ao nuôi không thuộc trang trại đã chọn');
    }

    // 4. Validate crop belongs to pond and is ACTIVE
    const crop = await this.prisma.crop.findUnique({
      where: { id: dto.cropId },
    });
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

    // 6. Auto-create Warning notification for critical statuses
    const isCritical =
      dto.healthStatus === 'EDGE_GATHERING' ||
      dto.healthStatus === 'LOSS_OF_APPETITE';

    if (isCritical) {
      const statusLabel =
        dto.healthStatus === 'EDGE_GATHERING' ? 'Tấp mé bờ' : 'Bỏ ăn';

      await this.prisma.notification.create({
        data: {
          farmId: dto.farmId,
          pondId: dto.pondId,
          level: 'WARNING',
          title: `Cảnh báo sức khỏe tôm: ${statusLabel}`,
          message: `Ao "${pond.name}" ghi nhận tình trạng "${statusLabel}" với tỷ lệ ảnh hưởng ${dto.affectedPercentage}%.`,
        },
      });

      // 7. Check for 3 consecutive critical records → Danger notification
      await this.checkConsecutiveCriticalRecords(
        dto.pondId,
        dto.cropId,
        dto.farmId,
        pond.name,
      );
    }

    return {
      id: record.id,
      message: 'Ghi nhận tình trạng sức khỏe tôm thành công.',
    };
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
   * If the last 3 records for this pond+crop are all critical
   * (EDGE_GATHERING or LOSS_OF_APPETITE), create a DANGER notification.
   */
  private async checkConsecutiveCriticalRecords(
    pondId: string,
    cropId: string,
    farmId: string,
    pondName: string,
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
      await this.prisma.notification.create({
        data: {
          farmId,
          pondId,
          level: 'DANGER',
          title: 'NGUY HIỂM: Sức khỏe tôm bất thường liên tục',
          message: `Ao "${pondName}" đã có 3 lần ghi nhận liên tiếp tình trạng sức khỏe bất thường. Cần kiểm tra ngay!`,
        },
      });
    }
  }
}
