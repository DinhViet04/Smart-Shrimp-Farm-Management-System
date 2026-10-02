import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateWaterQualityDto } from './dto/create-water-quality.dto.js';
import { WaterQualityResponseDto } from './dto/water-quality-response.dto.js';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationLevel } from '@prisma/client';

@Injectable()
export class WaterQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    user: AuthUser,
    dto: CreateWaterQualityDto,
  ): Promise<WaterQualityResponseDto> {
    // Tối ưu DB: Query thông tin Ao nuôi và Kỹ thuật viên đồng thời bằng Promise.all
    const [pond, technician] = await Promise.all([
      this.prisma.pond.findUnique({
        where: { id: dto.pondId },
        include: {
          farm: {
            select: {
              id: true,
              name: true,
              ownerId: true,
            },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { fullName: true },
      }),
    ]);

    if (!pond) {
      throw new NotFoundException('Khong tim thay ao nuoi');
    }

    await this.farmAccess.assertCanAccessFarm(user, pond.farmId);

    const record = await this.prisma.waterQualityRecord.create({
      data: {
        pondId: dto.pondId,
        recordTime: new Date(dto.recordTime),
        temperature: dto.temperature,
        ph: dto.ph,
        dissolvedOxygen: dto.dissolvedOxygen,
        salinity: dto.salinity,
        alkalinity: dto.alkalinity,
        nh3: dto.nh3,
        no2: dto.no2 ?? dto.h2s ?? 0,
        h2s: dto.h2s ?? dto.no2 ?? 0,
        transparency: dto.transparency,
        waterColor: dto.waterColor ?? null,
        note: dto.note ?? null,
        weatherData: dto.weatherData ?? null,
        createdBy: user.userId,
      },
    });

    // TỐI ƯU HIỆU NĂNG: Gửi thông báo realtime bất đồng bộ (fire-and-forget)
    // Giúp API response trả về tức thì cho KTV mà không bị nghẽn
    this.dispatchWaterQualityNotification(
      pond,
      technician?.fullName,
      dto,
      user.userId,
    ).catch((err) => {
      console.error(
        '[WaterQualityService] Lỗi gửi thông báo môi trường nước:',
        err,
      );
    });

    return {
      id: record.id,
      message: 'Ghi nhan thong so moi truong nuoc thanh cong.',
    };
  }

  /**
   * Thuật toán phân định đối tượng nhận thông báo & gửi thông báo môi trường nước:
   * - Đối tượng nhận: Chủ trang trại (FARM_MANAGER) + Tất cả Nông dân (FARMER) đang hoạt động thuộc ao/trại này.
   * - Loại trừ: Kỹ thuật viên vừa nhập liệu (tránh spam chính mình).
   */
  private async dispatchWaterQualityNotification(
    pond: {
      id: string;
      name: string;
      farmId: string;
      farm?: { id: string; name: string; ownerId: string } | null;
    },
    technicianName: string | undefined,
    dto: CreateWaterQualityDto,
    authorUserId: string,
  ) {
    // 1. Tìm tất cả nhân viên thuộc trang trại có role là FARMER hoặc FARM_MANAGER
    const staffMembers = await this.prisma.farmStaff.findMany({
      where: {
        farmId: pond.farmId,
        isActive: true,
        role: { in: ['FARMER', 'FARM_MANAGER'] },
        userId: { not: authorUserId },
      },
      select: { userId: true },
    });

    const recipientSet = new Set<string>();
    // Chủ sở hữu trang trại (FARM_MANAGER)
    if (pond.farm?.ownerId && pond.farm.ownerId !== authorUserId) {
      recipientSet.add(pond.farm.ownerId);
    }
    // Các nhân viên Nông dân / Quản lý
    staffMembers.forEach((s) => recipientSet.add(s.userId));

    const recipientUserIds = Array.from(recipientSet);
    if (recipientUserIds.length === 0) return;

    // 2. Tính toán trạng thái tổng quan theo thuật toán chuẩn của hệ thống
    const overallStatus = this.calculateOverallStatus({
      temperature: dto.temperature,
      ph: dto.ph,
      dissolvedOxygen: dto.dissolvedOxygen,
      salinity: dto.salinity,
      alkalinity: dto.alkalinity,
      nh3: dto.nh3,
      h2s: dto.h2s ?? dto.no2 ?? 0,
      transparency: dto.transparency,
      waterColor: dto.waterColor,
    });

    let level: NotificationLevel = NotificationLevel.INFO;
    let statusText = 'chỉ số ổn định';
    let title = `Cập nhật môi trường nước: ${pond.name}`;

    if (overallStatus === 'Danger') {
      level = NotificationLevel.DANGER;
      statusText = 'NGUY HIỂM';
      title = `⚠️ [NGUY HIỂM] Môi trường nước ${pond.name}`;
    } else if (overallStatus === 'Warning') {
      level = NotificationLevel.WARNING;
      statusText = 'CẦN CHÚ Ý';
      title = `⚡ [CHÚ Ý] Môi trường nước ${pond.name}`;
    }

    // 3. Phân tích các chỉ số vượt ngưỡng để đưa vào tóm tắt thông báo
    const alertPoints: string[] = [];
    if (Number(dto.dissolvedOxygen) <= 3.0) {
      alertPoints.push(`DO tụt thấp (${dto.dissolvedOxygen} mg/L)`);
    } else if (Number(dto.dissolvedOxygen) <= 4.0) {
      alertPoints.push(`DO hơi thấp (${dto.dissolvedOxygen} mg/L)`);
    }
    if (Number(dto.ph) < 7.5 || Number(dto.ph) > 8.5) {
      alertPoints.push(`pH biến động (${dto.ph})`);
    }
    if (Number(dto.nh3) > 0.3) {
      alertPoints.push(`Khí độc NH3 cao (${dto.nh3} mg/L)`);
    }

    const alertSummary =
      alertPoints.length > 0 ? ` [Cảnh báo: ${alertPoints.join(', ')}]` : '';
    const techDisplayName = technicianName || 'Kỹ thuật viên';
    const message = `KTV ${techDisplayName} vừa đo thông số ao "${pond.name}": DO ${dto.dissolvedOxygen} mg/L, pH ${dto.ph}, Temp ${dto.temperature}°C, Mặn ${dto.salinity}‰ (${statusText})${alertSummary}. Nhấn để xem chi tiết ao.`;

    await this.notificationsService.notifyWaterQualityUpdate({
      farmId: pond.farmId,
      pondId: pond.id,
      pondName: pond.name,
      farmName: pond.farm?.name || 'Trang trại',
      technicianName: techDisplayName,
      recipientUserIds,
      level,
      title,
      message,
    });
  }

  async findAllByPond(pondId: string, user: AuthUser) {
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      include: { farm: true },
    });

    if (!pond) {
      throw new NotFoundException('Khong tim thay ao nuoi');
    }

    await this.farmAccess.assertCanAccessFarm(user, pond.farmId);

    return this.prisma.waterQualityRecord.findMany({
      where: { pondId },
      orderBy: { recordTime: 'desc' },
    });
  }

  async findHistory(
    user: AuthUser,
    query: {
      farmId?: string;
      pondId?: string;
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
    const { farmId, pondId, fromDate, toDate } = query;
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    const where: any = {};

    if (pondId) {
      const pond = await this.prisma.pond.findUnique({
        where: { id: pondId },
        include: { farm: true },
      });
      if (!pond) {
        throw new NotFoundException('Khong tim thay ao nuoi');
      }
      await this.farmAccess.assertCanAccessFarm(user, pond.farmId);
      where.pondId = pondId;
    } else if (farmId) {
      const farm = await this.prisma.farm.findUnique({
        where: { id: farmId },
      });
      if (!farm) {
        throw new NotFoundException('Khong tim thay trang trai');
      }
      await this.farmAccess.assertCanAccessFarm(user, farmId);
      where.pond = { farmId };
    } else if (accessibleFarmIds) {
      where.pond = {
        farmId: { in: accessibleFarmIds },
      };
    }

    if (fromDate || toDate) {
      where.recordTime = {};
      if (fromDate) where.recordTime.gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.recordTime.lte = end;
      }
    }

    const skip = page * size;
    const take = size;

    const [records, totalElements] = await Promise.all([
      this.prisma.waterQualityRecord.findMany({
        where,
        include: {
          pond: {
            include: {
              farm: true,
            },
          },
        },
        orderBy: {
          recordTime: sort === 'asc' ? 'asc' : 'desc',
        },
        skip,
        take,
      }),
      this.prisma.waterQualityRecord.count({ where }),
    ]);

    const content = records.map((record) => {
      const h2sVal =
        record.h2s !== undefined && record.h2s !== null
          ? Number(record.h2s)
          : record.no2 !== undefined && record.no2 !== null
          ? Number(record.no2)
          : 0;

      const overallStatus = this.calculateOverallStatus({
        temperature: record.temperature,
        ph: record.ph,
        dissolvedOxygen: record.dissolvedOxygen,
        salinity: record.salinity,
        alkalinity: record.alkalinity,
        nh3: record.nh3,
        h2s: h2sVal,
        transparency: record.transparency,
        waterColor: record.waterColor,
      });

      return {
        id: record.id,
        recordTime: record.recordTime.toISOString(),
        farmName: record.pond?.farm?.name ?? 'Trang trại',
        pondName: record.pond?.name ?? 'Ao nuôi',
        temperature: Number(record.temperature),
        ph: Number(record.ph),
        dissolvedOxygen: Number(record.dissolvedOxygen),
        salinity: Number(record.salinity),
        alkalinity: Number(record.alkalinity),
        nh3: Number(record.nh3),
        h2s: h2sVal,
        no2: record.no2 !== undefined && record.no2 !== null ? Number(record.no2) : 0,
        transparency: Number(record.transparency),
        waterColor: record.waterColor ?? undefined,
        overallStatus,
        note: record.note,
        weatherData: record.weatherData,
        createdAt: record.createdAt.toISOString(),
      };
    });

    return {
      content,
      page,
      size,
      totalElements,
    };
  }

  async findTrends(
    pondId: string,
    fromDate: string,
    toDate: string,
    user: AuthUser,
  ) {
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      include: { farm: true },
    });
    if (!pond) {
      throw new NotFoundException('Khong tim thay ao nuoi');
    }
    await this.farmAccess.assertCanAccessFarm(user, pond.farmId);

    const where: any = { pondId };
    if (fromDate || toDate) {
      where.recordTime = {};
      if (fromDate) where.recordTime.gte = new Date(fromDate);
      if (toDate) where.recordTime.lte = new Date(toDate);
    }

    const records = await this.prisma.waterQualityRecord.findMany({
      where,
      orderBy: { recordTime: 'asc' },
    });

    return records.map((record) => {
      const h2sVal =
        record.h2s !== undefined && record.h2s !== null
          ? Number(record.h2s)
          : record.no2 !== undefined && record.no2 !== null
          ? Number(record.no2)
          : 0;

      const overallStatus = this.calculateOverallStatus({
        temperature: record.temperature,
        ph: record.ph,
        dissolvedOxygen: record.dissolvedOxygen,
        salinity: record.salinity,
        alkalinity: record.alkalinity,
        nh3: record.nh3,
        h2s: h2sVal,
        transparency: record.transparency,
        waterColor: record.waterColor,
      });

      return {
        id: record.id,
        recordTime: record.recordTime.toISOString(),
        temperature: Number(record.temperature),
        ph: Number(record.ph),
        dissolvedOxygen: Number(record.dissolvedOxygen),
        salinity: Number(record.salinity),
        alkalinity: Number(record.alkalinity),
        nh3: Number(record.nh3),
        h2s: h2sVal,
        no2: record.no2 !== undefined && record.no2 !== null ? Number(record.no2) : 0,
        transparency: Number(record.transparency),
        waterColor: record.waterColor ?? undefined,
        overallStatus,
      };
    });
  }

  private calculateOverallStatus(metrics: {
    temperature: any;
    ph: any;
    dissolvedOxygen: any;
    salinity: any;
    alkalinity: any;
    nh3: any;
    h2s: any;
    transparency: any;
    waterColor?: any;
  }): 'Optimal' | 'Warning' | 'Danger' {
    const temp = Number(metrics.temperature);
    const ph = Number(metrics.ph);
    const doVal = Number(metrics.dissolvedOxygen);
    const salinity = Number(metrics.salinity);
    const alkalinity = Number(metrics.alkalinity);
    const nh3 = Number(metrics.nh3);
    const h2s = Number(metrics.h2s);
    const transparency = Number(metrics.transparency);
    const waterColor = metrics.waterColor;

    const statuses = [
      this.getTempStatus(temp),
      this.getPhStatus(ph),
      this.getDoStatus(doVal),
      this.getSalinityStatus(salinity),
      this.getAlkalinityStatus(alkalinity),
      this.getNh3Status(nh3),
      this.getH2sStatus(h2s),
      this.getTransparencyStatus(transparency),
    ];

    if (waterColor) {
      statuses.push(this.getWaterColorStatus(waterColor));
    }

    if (statuses.includes('Danger')) return 'Danger';
    if (statuses.includes('Warning')) return 'Warning';
    return 'Optimal';
  }

  private getTempStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 25 && v <= 30) return 'Optimal';
    if ((v >= 20 && v < 25) || (v > 30 && v <= 33)) return 'Warning';
    return 'Danger';
  }

  private getPhStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 8.2 && v <= 8.5) return 'Optimal';
    if ((v >= 7.5 && v < 8.2) || (v > 8.5 && v <= 9.0)) return 'Warning';
    return 'Danger';
  }

  private getDoStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v > 4) return 'Optimal';
    if (v >= 3 && v <= 4) return 'Warning';
    return 'Danger';
  }

  private getSalinityStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 10 && v <= 25) return 'Optimal';
    if ((v >= 5 && v < 10) || (v > 25 && v <= 30)) return 'Warning';
    return 'Danger';
  }

  private getAlkalinityStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 100 && v <= 160) return 'Optimal';
    if ((v >= 80 && v < 100) || (v > 160 && v <= 200)) return 'Warning';
    return 'Danger';
  }

  private getNh3Status(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v <= 0.30) return 'Optimal';
    if (v > 0.30 && v <= 0.50) return 'Warning';
    return 'Danger';
  }

  private getH2sStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v <= 0.03) return 'Optimal';
    if (v > 0.03 && v <= 0.05) return 'Warning';
    return 'Danger';
  }

  private getNo2Status(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v <= 0.3) return 'Optimal';
    if (v > 0.3 && v <= 1.0) return 'Warning';
    return 'Danger';
  }

  private getTransparencyStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 25 && v <= 40) return 'Optimal';
    if ((v >= 20 && v < 25) || (v > 40 && v <= 50)) return 'Warning';
    return 'Danger';
  }

  private getWaterColorStatus(v: string): 'Optimal' | 'Warning' | 'Danger' {
    const val = v.toLowerCase().trim();
    if (val.includes('xanh lục') || val.includes('xanh vỏ đậu') || val.includes('màu nâu nhạt') || val.includes('nâu nhạt')) {
      return 'Optimal';
    }
    if (val.includes('đỏ') || val.includes('đen')) {
      return 'Danger';
    }
    return 'Warning';
  }
}
