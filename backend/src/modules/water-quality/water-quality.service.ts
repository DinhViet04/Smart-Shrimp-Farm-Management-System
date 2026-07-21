import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateWaterQualityDto } from './dto/create-water-quality.dto.js';
import { WaterQualityResponseDto } from './dto/water-quality-response.dto.js';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service.js';

@Injectable()
export class WaterQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(user: AuthUser, dto: CreateWaterQualityDto): Promise<WaterQualityResponseDto> {
    const pond = await this.prisma.pond.findUnique({
      where: { id: dto.pondId },
      include: { farm: true },
    });

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
        no2: dto.no2,
        transparency: dto.transparency,
        note: dto.note ?? null,
        createdBy: user.userId,
      },
    });

    return {
      id: record.id,
      message: 'Ghi nhan thong so moi truong nuoc thanh cong.',
    };
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
      if (toDate) where.recordTime.lte = new Date(toDate);
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
      const overallStatus = this.calculateOverallStatus({
        temperature: record.temperature,
        ph: record.ph,
        dissolvedOxygen: record.dissolvedOxygen,
        salinity: record.salinity,
        alkalinity: record.alkalinity,
        nh3: record.nh3,
        no2: record.no2,
        transparency: record.transparency,
      });

      return {
        id: record.id,
        recordTime: record.recordTime.toISOString(),
        farmName: record.pond.farm.name,
        pondName: record.pond.name,
        temperature: Number(record.temperature),
        ph: Number(record.ph),
        dissolvedOxygen: Number(record.dissolvedOxygen),
        salinity: Number(record.salinity),
        alkalinity: Number(record.alkalinity),
        nh3: Number(record.nh3),
        no2: Number(record.no2),
        transparency: Number(record.transparency),
        overallStatus,
        note: record.note,
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

  async findTrends(pondId: string, fromDate: string, toDate: string, user: AuthUser) {
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
      const overallStatus = this.calculateOverallStatus({
        temperature: record.temperature,
        ph: record.ph,
        dissolvedOxygen: record.dissolvedOxygen,
        salinity: record.salinity,
        alkalinity: record.alkalinity,
        nh3: record.nh3,
        no2: record.no2,
        transparency: record.transparency,
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
        no2: Number(record.no2),
        transparency: Number(record.transparency),
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
    no2: any;
    transparency: any;
  }): 'Optimal' | 'Warning' | 'Danger' {
    const temp = Number(metrics.temperature);
    const ph = Number(metrics.ph);
    const doVal = Number(metrics.dissolvedOxygen);
    const salinity = Number(metrics.salinity);
    const alkalinity = Number(metrics.alkalinity);
    const nh3 = Number(metrics.nh3);
    const no2 = Number(metrics.no2);
    const transparency = Number(metrics.transparency);

    const statuses = [
      this.getTempStatus(temp),
      this.getPhStatus(ph),
      this.getDoStatus(doVal),
      this.getSalinityStatus(salinity),
      this.getAlkalinityStatus(alkalinity),
      this.getNh3Status(nh3),
      this.getNo2Status(no2),
      this.getTransparencyStatus(transparency),
    ];

    if (statuses.includes('Danger')) return 'Danger';
    if (statuses.includes('Warning')) return 'Warning';
    return 'Optimal';
  }

  private getTempStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 28 && v <= 32) return 'Optimal';
    if ((v >= 25 && v < 28) || (v > 32 && v <= 34)) return 'Warning';
    return 'Danger';
  }

  private getPhStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 7.5 && v <= 8.5) return 'Optimal';
    if ((v >= 7.0 && v < 7.5) || (v > 8.5 && v <= 9.0)) return 'Warning';
    return 'Danger';
  }

  private getDoStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v > 5) return 'Optimal';
    if (v >= 4 && v <= 5) return 'Warning';
    return 'Danger';
  }

  private getSalinityStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 10 && v <= 25) return 'Optimal';
    if ((v >= 5 && v < 10) || (v > 25 && v <= 30)) return 'Warning';
    return 'Danger';
  }

  private getAlkalinityStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 80 && v <= 200) return 'Optimal';
    if ((v >= 60 && v < 80) || (v > 200 && v <= 250)) return 'Warning';
    return 'Danger';
  }

  private getNh3Status(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v <= 0.10) return 'Optimal';
    if (v > 0.10 && v <= 0.30) return 'Warning';
    return 'Danger';
  }

  private getNo2Status(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v <= 0.30) return 'Optimal';
    if (v > 0.30 && v <= 1.00) return 'Warning';
    return 'Danger';
  }

  private getTransparencyStatus(v: number): 'Optimal' | 'Warning' | 'Danger' {
    if (v >= 30 && v <= 40) return 'Optimal';
    if ((v >= 20 && v < 30) || (v > 40 && v <= 50)) return 'Warning';
    return 'Danger';
  }
}
