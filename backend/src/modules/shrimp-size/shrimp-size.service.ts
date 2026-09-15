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
}
