import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SurvivalRateService } from './survival-rate.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FarmAccessService } from '../farm-access/farm-access.service.js';

describe('SurvivalRateService', () => {
  let service: SurvivalRateService;

  const mockPrismaService = {
    crop: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    mortalityLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockFarmAccessService = {
    assertCanAccessFarm: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurvivalRateService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FarmAccessService, useValue: mockFarmAccessService },
      ],
    }).compile();

    service = module.get<SurvivalRateService>(SurvivalRateService);

    jest.clearAllMocks();
  });

  describe('calculateSurvivalRate', () => {
    it('should calculate survival rate based strictly on recorded actualHarvestCount / initialShrimpCount (88,000 / 100,000 -> 88%)', async () => {
      const mockCrop = {
        id: 'crop-1',
        initialShrimpCount: 100000,
        actualHarvestCount: 88000,
        targetSurvivalRate: 85,
        startDate: new Date('2026-01-01'),
        status: 'HARVESTED',
        pond: { name: 'Ao A1', farmId: 'farm-1' },
      };

      mockPrismaService.crop.findUnique.mockResolvedValue(mockCrop);

      const result = await service.calculateSurvivalRate(
        { userId: 'user-1', role: 'FARM_MANAGER' },
        'crop-1',
      );

      expect(result).toEqual({
        cropId: 'crop-1',
        pondName: 'Ao A1',
        startDate: mockCrop.startDate,
        initialStocking: 100000,
        harvestCount: 88000,
        survivalRate: 88,
        targetSurvivalRate: 85,
        isHarvested: true,
        status: 'OPTIMAL',
      });
    });

    it('should calculate survival rate from actualHarvestKg and actualHarvestSize (1,600 kg * 50 con/kg = 80,000 con / 100,000 -> 80%)', async () => {
      const mockCrop = {
        id: 'crop-2',
        initialShrimpCount: 100000,
        actualHarvestCount: null,
        actualHarvestKg: 1600,
        actualHarvestSize: 50,
        targetSurvivalRate: 85,
        startDate: new Date('2026-01-01'),
        status: 'HARVESTED',
        pond: { name: 'Ao A2', farmId: 'farm-1' },
      };

      mockPrismaService.crop.findUnique.mockResolvedValue(mockCrop);

      const result = await service.calculateSurvivalRate(
        { userId: 'user-1', role: 'FARM_MANAGER' },
        'crop-2',
      );

      expect(result.harvestCount).toBe(80000);
      expect(result.survivalRate).toBe(80);
      expect(result.status).toBe('WARNING');
    });

    it('should return 0% survival rate if harvest count is 0', async () => {
      const mockCrop = {
        id: 'crop-3',
        initialShrimpCount: 100000,
        actualHarvestCount: 0,
        targetSurvivalRate: 85,
        startDate: new Date('2026-01-01'),
        status: 'FAILED',
        pond: { name: 'Ao A3', farmId: 'farm-1' },
      };

      mockPrismaService.crop.findUnique.mockResolvedValue(mockCrop);

      const result = await service.calculateSurvivalRate(
        { userId: 'user-1', role: 'FARM_MANAGER' },
        'crop-3',
      );

      expect(result.harvestCount).toBe(0);
      expect(result.survivalRate).toBe(0);
      expect(result.status).toBe('DANGER');
    });

    it('should throw BadRequestException ("Chưa có dữ liệu thả giống") when initial stocking is 0 or missing', async () => {
      const mockCrop = {
        id: 'crop-4',
        initialShrimpCount: 0,
        pond: { name: 'Ao A4', farmId: 'farm-1' },
      };

      mockPrismaService.crop.findUnique.mockResolvedValue(mockCrop);

      await expect(
        service.calculateSurvivalRate(
          { userId: 'user-1', role: 'FARM_MANAGER' },
          'crop-4',
        ),
      ).rejects.toThrow('Chưa có dữ liệu thả giống');
    });

    it('should throw NotFoundException when crop is not found', async () => {
      mockPrismaService.crop.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateSurvivalRate(
          { userId: 'user-1', role: 'FARM_MANAGER' },
          'invalid-crop-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
