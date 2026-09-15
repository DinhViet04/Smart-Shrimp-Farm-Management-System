import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateShrimpSizeSampleDto } from './dto/create-shrimp-size-sample.dto.js';

@Injectable()
export class ShrimpSizeService {
  constructor(private prisma: PrismaService) {}

  async createSample(pondId: string, dto: CreateShrimpSizeSampleDto) {
    // Validate numbers
    if (dto.sampleCount <= 0 || dto.sampleWeightGram <= 0) {
      throw new BadRequestException('Sample count and weight must be positive numbers.');
    }

    // 1. Calculate ABW and Size
    const abwGram = dto.sampleWeightGram / dto.sampleCount;
    const sizePerKg = 1000 / abwGram;

    // 2. Determine DOC
    let doc: number | null = null;
    const samplingDate = dto.samplingDate ? new Date(dto.samplingDate) : new Date();

    const activeCrop = await this.prisma.crop.findFirst({
      where: {
        pondId,
        status: 'ACTIVE',
      },
    });

    if (!activeCrop) {
      throw new BadRequestException('Ao này hiện không có vụ nuôi nào đang hoạt động. Không thể ghi nhận mẫu.');
    }

    if (activeCrop && activeCrop.startDate) {
      const diffTime = Math.abs(samplingDate.getTime() - activeCrop.startDate.getTime());
      doc = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // 3. Calculate ADG
    let adgGramPerDay: number | null = null;
    
    // Find the latest sample before this one
    const previousSample = await this.prisma.shrimpSizeSample.findFirst({
      where: {
        pondId,
        samplingDate: {
          lt: samplingDate,
        },
      },
      orderBy: {
        samplingDate: 'desc',
      },
    });

    if (previousSample) {
      const prevDate = new Date(previousSample.samplingDate);
      const diffDays = (samplingDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (diffDays > 0) {
        adgGramPerDay = (abwGram - Number(previousSample.abwGram)) / diffDays;
      }
    }

    // 4. Save to DB
    const sample = await this.prisma.shrimpSizeSample.create({
      data: {
        pondId,
        sampleCount: dto.sampleCount,
        sampleWeightGram: dto.sampleWeightGram,
        sampleLengthCm: dto.sampleLengthCm,
        abwGram,
        sizePerKg,
        adgGramPerDay,
        doc,
        samplingDate,
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
