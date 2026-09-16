import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateShrimpSizeSampleDto } from './dto/create-shrimp-size-sample.dto.js';

@Injectable()
export class ShrimpSizeService {
  constructor(private prisma: PrismaService) {}

  async createSample(pondId: string, dto: CreateShrimpSizeSampleDto) {
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

    return sample;
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

  async deleteSample(pondId: string, sampleId: string) {
    // Delete the sample
    await this.prisma.shrimpSizeSample.delete({
      where: { id: sampleId, pondId },
    });

    // To be perfectly accurate, deleting a sample in the middle should trigger ADG recalculation 
    // for the sample immediately following it. 
    // For simplicity, we just recalculate ADG for ALL samples of the pond sequentially.
    await this.recalculateADG(pondId);
    
    return { success: true };
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

    const history = [];
    let previousDate = activeCrop.startDate || new Date(0);
    let previousBiomass = 0;
    
    let cumulativeFeedAll = 0;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const currentBiomass = Number(sample.estimatedBiomassKg);
      
      const feedResult = await this.prisma.feedingLog.aggregate({
        _sum: { feedAmount: true },
        where: {
          cropId: activeCrop.id,
          feedingStatus: { not: 'SKIPPED' },
          feedingDate: i === 0 ? { lte: sample.samplingDate } : {
            gt: previousDate,
            lte: sample.samplingDate,
          }
        }
      });

      const periodFeed = Number(feedResult._sum.feedAmount) || 0;
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

      previousDate = sample.samplingDate;
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
