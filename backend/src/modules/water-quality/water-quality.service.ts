import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateWaterQualityDto } from './dto/create-water-quality.dto.js';
import { WaterQualityResponseDto } from './dto/water-quality-response.dto.js';

/**
 * Service for water quality record operations.
 *
 * Responsibilities:
 *  - Verify the target pond exists.
 *  - Verify the requesting Farmer owns the pond's farm.
 *  - Persist the WaterQualityRecord.
 *
 * Reusable by: Water Quality History, Trend Analysis,
 *              Environmental Warning, AI Analysis modules.
 */
@Injectable()
export class WaterQualityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new water quality record for a pond owned by the requesting farmer.
   *
   * @param userId - The authenticated Farmer's user ID (from JWT payload).
   * @param dto    - Validated creation payload.
   * @returns      - The new record's UUID and a success message.
   * @throws NotFoundException    if the pond does not exist.
   * @throws ForbiddenException   if the farmer does not own the pond's farm.
   */
  async create(
    user: { userId: string; role: string },
    dto: CreateWaterQualityDto,
  ): Promise<WaterQualityResponseDto> {
    // 1. Load pond along with its parent farm to validate ownership
    const pond = await this.prisma.pond.findUnique({
      where: { id: dto.pondId },
      include: { farm: true },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao nuôi');
    }

    // 2. Security: ensure the user owns the farm or is assigned as staff (skip for ADMIN)
    if (user.role !== 'ADMIN' && pond.farm.ownerId !== user.userId) {
      const isStaff = await this.prisma.farmStaff.findUnique({
        where: {
          farmId_userId: {
            farmId: pond.farmId,
            userId: user.userId,
          },
        },
      });
      if (!isStaff) {
        throw new ForbiddenException(
          'Bạn không có quyền ghi nhận thông số môi trường cho ao này',
        );
      }
    }

    // 3. Persist the record
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
        note: dto.note ?? null,
        createdBy: user.userId,
      },
    });

    return {
      id: record.id,
      message: 'Ghi nhận thông số môi trường nước thành công.',
    };
  }

  /**
   * Retrieves all water quality records for a given pond,
   * ordered most-recent first.
   *
   * Used by Water Quality History, Trend Analysis, Environmental Warning,
   * and AI Analysis modules.
   *
   * @param pondId - Target pond UUID.
   * @param user   - Requesting user's ID & role (ownership check).
   */
  async findAllByPond(pondId: string, user: { userId: string; role: string }) {
    // Verify pond exists and belongs to the user
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      include: { farm: true },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao nuôi');
    }

    if (user.role !== 'ADMIN' && pond.farm.ownerId !== user.userId) {
      const isStaff = await this.prisma.farmStaff.findUnique({
        where: {
          farmId_userId: {
            farmId: pond.farmId,
            userId: user.userId,
          },
        },
      });
      if (!isStaff) {
        throw new ForbiddenException('Bạn không có quyền xem ao nuôi này');
      }
    }

    return this.prisma.waterQualityRecord.findMany({
      where: { pondId },
      orderBy: { recordTime: 'desc' },
    });
  }

  /**
   * Retrieves paginated, sorted, and filtered water quality records for the farmer's owned ponds.
   * Calculates overall status dynamically.
   */
  async findHistory(user: { userId: string; role: string }, query: {
    farmId?: string;
    pondId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
    sort?: string;
  }) {
    const page = query.page ?? 0;
    const size = query.size ?? 10;
    const sort = query.sort ?? 'desc';
    const { farmId, pondId, fromDate, toDate } = query;

    const where: any = {};

    // 1. Verify ownership of farm or pond if specified
    if (pondId) {
      const pond = await this.prisma.pond.findUnique({
        where: { id: pondId },
        include: { farm: true },
      });
      if (!pond) {
        throw new NotFoundException('Không tìm thấy ao nuôi');
      }
      if (user.role !== 'ADMIN' && pond.farm.ownerId !== user.userId) {
        const isStaff = await this.prisma.farmStaff.findUnique({
          where: {
            farmId_userId: {
              farmId: pond.farmId,
              userId: user.userId,
            },
          },
        });
        if (!isStaff) {
          throw new ForbiddenException('Bạn không có quyền truy cập ao nuôi này');
        }
      }
      where.pondId = pondId;
    } else if (farmId) {
      const farm = await this.prisma.farm.findUnique({
        where: { id: farmId },
      });
      if (!farm) {
        throw new NotFoundException('Không tìm thấy trang trại');
      }
      if (user.role !== 'ADMIN' && farm.ownerId !== user.userId) {
        const isStaff = await this.prisma.farmStaff.findUnique({
          where: {
            farmId_userId: {
              farmId,
              userId: user.userId,
            },
          },
        });
        if (!isStaff) {
          throw new ForbiddenException('Bạn không có quyền truy cập trang trại này');
        }
      }
      where.pond = { farmId: farmId };
    } else {
      // For admins, do not filter by ownerId or staff if no farmId/pondId is specified.
      if (user.role !== 'ADMIN') {
        where.pond = {
          farm: {
            OR: [
              { ownerId: user.userId },
              { staff: { some: { userId: user.userId } } }
            ]
          },
        };
      }
    }

    // 2. Date filtering
    if (fromDate || toDate) {
      where.recordTime = {};
      if (fromDate) {
        where.recordTime.gte = new Date(fromDate);
      }
      if (toDate) {
        where.recordTime.lte = new Date(toDate);
      }
    }

    // 3. Pagination & Count queries
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

    // 4. Map records and calculate overall status
    const content = records.map((record) => {
      const overallStatus = this.calculateOverallStatus({
        temperature: record.temperature,
        ph: record.ph,
        dissolvedOxygen: record.dissolvedOxygen,
        salinity: record.salinity,
        alkalinity: record.alkalinity,
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

  /**
   * Helper to calculate rule-based overall status for a record.
   */
  private calculateOverallStatus(metrics: {
    temperature: any;
    ph: any;
    dissolvedOxygen: any;
    salinity: any;
    alkalinity: any;
  }): 'Optimal' | 'Warning' | 'Danger' {
    const temp = Number(metrics.temperature);
    const ph = Number(metrics.ph);
    const doVal = Number(metrics.dissolvedOxygen);
    const salinity = Number(metrics.salinity);
    const alkalinity = Number(metrics.alkalinity);

    const statuses = [
      this.getTempStatus(temp),
      this.getPhStatus(ph),
      this.getDoStatus(doVal),
      this.getSalinityStatus(salinity),
      this.getAlkalinityStatus(alkalinity),
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
}
