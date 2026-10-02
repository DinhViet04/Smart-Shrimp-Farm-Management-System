import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateShrimpSizeSampleDto } from './dto/create-shrimp-size-sample.dto.js';

@Injectable()
export class ShrimpSizeService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createSample(pondId: string, dto: CreateShrimpSizeSampleDto, user?: any) {
    // 1. Validate inputs and calculate totals
    if (!dto.casts || dto.casts.length !== 5) {
      throw new BadRequestException('Bắt buộc phải nhập đủ 5 mẻ chài.');
    }

    let totalCount = 0;
    let totalWeight = 0;
    
    for (const cast of dto.casts) {
      if (cast.count < 0 || cast.weightGram < 0) {
         throw new BadRequestException('Số lượng và khối lượng tôm phải là số dương.');
      }
      totalCount += cast.count;
      totalWeight += cast.weightGram;
    }

    if (totalCount <= 0 || totalWeight <= 0) {
      throw new BadRequestException('Tổng số tôm và khối lượng từ 5 mẻ chài phải lớn hơn 0.');
    }

    // 2. Determine DOC
    let doc: number | null = null;
    const samplingDate = dto.samplingDate ? new Date(dto.samplingDate) : new Date();

    const activeCrop = await this.prisma.crop.findFirst({
      where: {
        pondId,
        status: 'ACTIVE',
      },
      include: {
        pond: true
      }
    });

    if (!activeCrop) {
      throw new BadRequestException('Ao này hiện không có vụ nuôi nào đang hoạt động. Không thể ghi nhận mẫu.');
    }

    if (activeCrop && activeCrop.startDate) {
      const diffTime = Math.abs(samplingDate.getTime() - activeCrop.startDate.getTime());
      doc = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // 3. Calculate ABW and Size
    const abwGram = totalWeight / totalCount;
    const sizePerKg = 1000 / abwGram;

    // 4. Calculate ADG
    let adgGramPerDay: number | null = null;
    const previousSample = await this.prisma.shrimpSizeSample.findFirst({
      where: {
        pondId,
        samplingDate: { lt: samplingDate },
      },
      orderBy: { samplingDate: 'desc' },
    });

    if (previousSample) {
      const prevDate = new Date(previousSample.samplingDate);
      const diffDays = (samplingDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 0) {
        adgGramPerDay = (abwGram - Number(previousSample.abwGram)) / diffDays;
      }
    }

    // 5. Calculate Biomass
    let estimatedTotalShrimp: number | null = null;
    let estimatedBiomassKg: number | null = null;

    if (dto.netAreaSqM > 0) {
      // Mật độ mẫu (con/m2) = Tổng số tôm / (Số lần chài * Diện tích chài)
      const dMau = totalCount / (5 * dto.netAreaSqM);
      const pondArea = activeCrop.pond.areaSize;
      
      estimatedTotalShrimp = Math.round(dMau * pondArea);
      estimatedBiomassKg = (estimatedTotalShrimp * abwGram) / 1000;
    }

    // 6. Save to DB
    const sample = await this.prisma.shrimpSizeSample.create({
      data: {
        pondId,
        sampleCount: totalCount,
        sampleWeightGram: totalWeight,
        sampleLengthCm: dto.sampleLengthCm,
        abwGram,
        sizePerKg,
        adgGramPerDay,
        doc,
        samplingDate,
        netAreaSqM: dto.netAreaSqM,
        castDetails: JSON.stringify(dto.casts),
        estimatedTotalShrimp,
        estimatedBiomassKg,
        notes: dto.notes,
      },
    });

    // 7. Phát thông báo Realtime cho Manager và Farmer (Bất đồng bộ - Không chặn luồng response)
    void this.dispatchGrowthNotification(pondId, sample, activeCrop, user);

    return sample;
  }

  /**
   * Phân tích và phát thông báo Realtime cập nhật tăng trưởng tôm
   * Tối ưu hiệu năng: Xử lý song song, bulk insert, không block request người dùng
   */
  private async dispatchGrowthNotification(
    pondId: string,
    sample: any,
    activeCrop: any,
    technicianUser?: any,
  ) {
    try {
      const pond = await this.prisma.pond.findUnique({
        where: { id: pondId },
        select: { id: true, name: true, farmId: true },
      });
      if (!pond) return;

      // Truy vấn song song farm, staff và thông tin kỹ thuật viên
      const [farm, staffMembers, technician] = await Promise.all([
        this.prisma.farm.findUnique({
          where: { id: pond.farmId },
          select: { id: true, name: true, ownerId: true },
        }),
        this.prisma.farmStaff.findMany({
          where: {
            farmId: pond.farmId,
            isActive: true,
            role: { in: ['FARMER', 'FARM_MANAGER'] },
          },
          select: { userId: true },
        }),
        technicianUser?.fullName
          ? Promise.resolve(technicianUser)
          : technicianUser?.id
            ? this.prisma.user.findUnique({
                where: { id: technicianUser.id },
                select: { id: true, fullName: true },
              })
            : Promise.resolve(null),
      ]);

      if (!farm) return;

      const technicianId = technicianUser?.id || null;
      const technicianName = technician?.fullName || 'Kỹ thuật viên';

      // Tập hợp người nhận: Chủ trang trại / Quản lý + Nông dân / Quản lý trong FarmStaff (loại trừ KTV vừa nhập)
      const recipientSet = new Set<string>();
      if (farm.ownerId && farm.ownerId !== technicianId) {
        recipientSet.add(farm.ownerId);
      }
      for (const staff of staffMembers) {
        if (staff.userId && staff.userId !== technicianId) {
          recipientSet.add(staff.userId);
        }
      }

      const recipientUserIds = Array.from(recipientSet);
      if (recipientUserIds.length === 0) return;

      // Tự động phân tích FCR ngay sau khi có mẫu đo mới
      const fcrData = await this.analyzeFCR(pond.id).catch(() => null);
      const currentFCR = fcrData?.currentFCR ?? null;
      const fcrTarget = fcrData?.fcrTarget ?? 1.2;

      // Thuật toán đánh giá mức độ cảnh báo tăng trưởng & hiệu quả sử dụng thức ăn FCR
      let level: NotificationLevel = NotificationLevel.INFO;
      let statusComment = 'Tăng trưởng & chuyển hóa thức ăn ổn định';

      const initialCount = activeCrop?.initialShrimpCount || 0;
      let survivalRate: number | null = null;
      if (sample.estimatedTotalShrimp && initialCount > 0) {
        survivalRate = (Number(sample.estimatedTotalShrimp) / initialCount) * 100;
      }

      // Đánh giá dựa trên tốc độ lớn ADG, tỷ lệ sống ước tính và hệ số FCR
      if (sample.adgGramPerDay !== null && Number(sample.adgGramPerDay) < 0) {
        level = NotificationLevel.DANGER;
        statusComment = 'Cảnh báo: Tôm sụt cân bất thường (ADG âm)';
      } else if (survivalRate !== null && survivalRate < 70) {
        level = NotificationLevel.DANGER;
        statusComment = `Tỷ lệ sống sụt giảm đáng báo động (${survivalRate.toFixed(1)}%)`;
      } else if (currentFCR !== null && currentFCR > 1.5) {
        level = NotificationLevel.DANGER;
        statusComment = `Cảnh báo: FCR quá cao (${currentFCR} so với mục tiêu ${fcrTarget}), nguy cơ lãng phí & ô nhiễm`;
      } else if (
        (sample.adgGramPerDay !== null && Number(sample.adgGramPerDay) < 0.1 && (sample.doc || 0) > 30) ||
        (survivalRate !== null && survivalRate < 85) ||
        (currentFCR !== null && currentFCR > 1.35)
      ) {
        level = NotificationLevel.WARNING;
        statusComment = currentFCR !== null && currentFCR > 1.35
          ? `Hệ số FCR tăng nhẹ (${currentFCR}), cần cân đối lượng cám cho ăn`
          : 'Tốc độ tăng trọng chậm hoặc tỷ lệ sống dưới mức tối ưu';
      }

      const abwStr = Number(sample.abwGram).toFixed(2);
      const sizeStr = Number(sample.sizePerKg).toFixed(1);
      const adgStr = sample.adgGramPerDay !== null ? `${Number(sample.adgGramPerDay).toFixed(2)} g/ngày` : 'Lần đo đầu';
      const biomassStr = sample.estimatedBiomassKg ? `${Math.round(Number(sample.estimatedBiomassKg)).toLocaleString()} kg` : '--';
      const fcrStr = currentFCR !== null ? `${currentFCR} (Mục tiêu: ${fcrTarget})` : 'Đang tính toán';

      const title = `Tăng trưởng & FCR ${pond.name} (DOC ${sample.doc || '--'}): Size ${sizeStr} con/kg - FCR ${currentFCR !== null ? currentFCR : '--'}`;
      const message = `${technicianName} vừa cập nhật mẫu đo tại ao ${pond.name} (${farm.name}). Trọng lượng: ${abwStr}g/con, ADG: ${adgStr}, Sinh khối: ${biomassStr}, FCR: ${fcrStr}. Đánh giá: ${statusComment}.`;

      await this.notificationsService.notifyGrowthUpdate({
        farmId: farm.id,
        pondId: pond.id,
        pondName: pond.name,
        farmName: farm.name,
        technicianName,
        recipientUserIds,
        level,
        title,
        message,
      });
    } catch (err) {
      console.error('Lỗi khi gửi thông báo tăng trưởng (non-blocking):', err);
    }
  }

  async getSamplesByPond(pondId: string) {
    return this.prisma.shrimpSizeSample.findMany({
      where: { pondId },
      orderBy: { samplingDate: 'asc' },
    });
  }

  async getLatestSample(pondId: string) {
    const sample = await this.prisma.shrimpSizeSample.findFirst({
      where: { pondId },
      orderBy: { samplingDate: 'desc' },
    });

    if (!sample) {
      throw new NotFoundException(`No size samples found for pond ${pondId}`);
    }
    return sample;
  }

  /**
   * Get the current estimated total shrimp count for a pond based on latest sampling.
   */
  async getCurrentShrimpCount(pondId: string): Promise<number | null> {
    const sample = await this.prisma.shrimpSizeSample.findFirst({
      where: { pondId, estimatedTotalShrimp: { not: null } },
      orderBy: { samplingDate: 'desc' },
    });

    return sample?.estimatedTotalShrimp ?? null;
  }

  async deleteSample(pondId: string, sampleId: string) {
    // 1. Kiểm tra mẫu có tồn tại và thuộc ao này không
    const sample = await this.prisma.shrimpSizeSample.findFirst({
      where: { id: sampleId, pondId },
    });

    if (!sample) {
      throw new NotFoundException('Không tìm thấy mẫu đo đạc kích cỡ này.');
    }

    // 2. Xóa mẫu theo id duy nhất
    await this.prisma.shrimpSizeSample.delete({
      where: { id: sampleId },
    });

    // 3. Tính toán lại ADG cho các mẫu còn lại của ao
    await this.recalculateADG(pondId);
    
    return { success: true, message: 'Đã xóa mẫu đo đạc thành công' };
  }

  private async recalculateADG(pondId: string) {
    const samples = await this.prisma.shrimpSizeSample.findMany({
      where: { pondId },
      orderBy: { samplingDate: 'asc' },
    });

    for (let i = 0; i < samples.length; i++) {
      let adg: number | null = null;
      if (i > 0) {
        const current = samples[i];
        const prev = samples[i - 1];
        
        const diffDays = (new Date(current.samplingDate).getTime() - new Date(prev.samplingDate).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 0) {
          adg = (Number(current.abwGram) - Number(prev.abwGram)) / diffDays;
        }
      }

      await this.prisma.shrimpSizeSample.update({
        where: { id: samples[i].id },
        data: { adgGramPerDay: adg },
      });
    }
  }

  async analyzeFCR(pondId: string) {
    const activeCrop = await this.prisma.crop.findFirst({
      where: {
        pondId,
        status: 'ACTIVE',
      },
    });

    if (!activeCrop) {
      throw new BadRequestException('Ao này hiện không có vụ nuôi nào đang hoạt động.');
    }

    let fcrTarget = 1.20;
    if (activeCrop.targetTotalFeedKg && activeCrop.targetSurvivalRate && activeCrop.targetHarvestSize && activeCrop.initialShrimpCount) {
      const expectedHarvestWeight = (activeCrop.initialShrimpCount * (activeCrop.targetSurvivalRate / 100)) / activeCrop.targetHarvestSize;
      if (expectedHarvestWeight > 0) {
        fcrTarget = Number((activeCrop.targetTotalFeedKg / expectedHarvestWeight).toFixed(2));
      }
    }

    const samples = await this.prisma.shrimpSizeSample.findMany({
      where: {
        pondId,
        estimatedBiomassKg: { not: null },
      },
      orderBy: { samplingDate: 'asc' },
    });

    if (samples.length === 0) {
      return {
        currentFCR: null,
        fcrDiff: null,
        totalFeedUsed: 0,
        totalBiomassGain: 0,
        avgWeight: 0,
        fcrTarget,
        targetTotalFeedKg: activeCrop.targetTotalFeedKg || null,
        history: [],
      };
    }

    // Tối ưu hóa hiệu năng: Tải toàn bộ feeding logs của vụ nuôi trong 1 query duy nhất thay vì lặp N query
    const feedingLogs = await this.prisma.feedingLog.findMany({
      where: {
        cropId: activeCrop.id,
        feedingStatus: { not: 'SKIPPED' },
      },
      select: {
        feedingDate: true,
        feedAmount: true,
      },
      orderBy: { feedingDate: 'asc' },
    });

    const history = [];
    let previousDate = activeCrop.startDate ? new Date(activeCrop.startDate) : new Date(0);
    let previousBiomass = 0;
    
    let cumulativeFeedAll = 0;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const currentBiomass = Number(sample.estimatedBiomassKg);
      const sampleDate = new Date(sample.samplingDate);
      
      const periodLogs = feedingLogs.filter((log) => {
        const logDate = new Date(log.feedingDate);
        if (i === 0) {
          return logDate <= sampleDate;
        }
        return logDate > previousDate && logDate <= sampleDate;
      });

      const periodFeed = periodLogs.reduce((sum, log) => sum + (Number(log.feedAmount) || 0), 0);
      cumulativeFeedAll += periodFeed;
      
      const biomassGain = currentBiomass - previousBiomass;
      let periodFCR = null;
      let status = 'BÌNH THƯỜNG';
      
      if (biomassGain > 0) {
        periodFCR = periodFeed / biomassGain;
        if (periodFCR < 1.2) status = 'TỐT';
        else if (periodFCR <= 1.4) status = 'BÌNH THƯỜNG';
        else status = 'CẢNH BÁO';
      }

      history.push({
        id: sample.id,
        periodName: `Lần đo ${i + 1}`,
        date: sample.samplingDate,
        feedAmount: periodFeed,
        biomassGain: biomassGain,
        periodFCR: periodFCR !== null ? Number(periodFCR.toFixed(2)) : null,
        status
      });

      previousDate = sampleDate;
      previousBiomass = currentBiomass;
    }

    const latestSample = samples[samples.length - 1];
    const totalBiomassGain = Number(latestSample.estimatedBiomassKg);
    const currentFCR = totalBiomassGain > 0 ? cumulativeFeedAll / totalBiomassGain : null;

    let fcrDiff = null;
    if (history.length >= 2) {
      const latestPeriodFCR = history[history.length - 1].periodFCR;
      const prevPeriodFCR = history[history.length - 2].periodFCR;
      if (latestPeriodFCR !== null && prevPeriodFCR !== null) {
        fcrDiff = Number((latestPeriodFCR - prevPeriodFCR).toFixed(2));
      }
    }

    history.reverse();

    return {
      currentFCR: currentFCR !== null ? Number(currentFCR.toFixed(2)) : null,
      fcrDiff,
      totalFeedUsed: cumulativeFeedAll,
      totalBiomassGain,
      avgWeight: Number(latestSample.abwGram),
      fcrTarget,
      targetTotalFeedKg: activeCrop.targetTotalFeedKg || null,
      history,
    };
  }
}
