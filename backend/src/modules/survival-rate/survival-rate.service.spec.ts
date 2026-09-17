import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SurvivalRateService } from './survival-rate.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FarmAccessService } from '../farm-access/farm-access.service.js';
import { ShrimpSizeService } from '../shrimp-size/shrimp-size.service.js';

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

  const mockShrimpSizeService = {
    getCurrentShrimpCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurvivalRateService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FarmAccessService, useValue: mockFarmAccessService },
        { provide: ShrimpSizeService, useValue: mockShrimpSizeService },
      ],
    }).compile();

    service = module.get<SurvivalRateService>(SurvivalRateService);

    jest.clearAllMocks();
  });

  describe('calculateSurvivalRate', () => {
    it('should calculate survival rate by reusing getCurrentShrimpCount from ShrimpSizeService (85,000 / 100,000 -> 85%)', async () => {
      const mockCrop = {
        id: 'crop-1',
        pondId: 'pond-1',
        initialShrimpCount: 100000,
        targetSurvivalRate: 85,
        startDate: new Date('2026-01-01'),
        status: 'ACTIVE',
        pond: { name: 'Ao A1', farmId: 'farm-1' },
      };

      mockPrismaService.crop.findUnique.mockResolvedValue(mockCrop);
      mockShrimpSizeService.getCurrentShrimpCount.mockResolvedValue(85000);

      const result = await service.calculateSurvivalRate(
        { userId: 'user-1', role: 'FARM_MANAGER' },
        'crop-1',
      );

      expect(mockShrimpSizeService.getCurrentShrimpCount).toHaveBeenCalledWith('pond-1');
      expect(result).toEqual({
        cropId: 'crop-1',
        pondName: 'Ao A1',
        startDate: mockCrop.startDate,
        initialStocking: 100000,
        currentShrimpCount: 85000,
        harvestCount: 85000,
        survivalRate: 85,
        targetSurvivalRate: 85,
        isHarvested: false,
        status: 'OPTIMAL',
      });
    });

    it('should cap survival rate at 100% maximum if current shrimp count exceeds stocking quantity', async () => {
      const mockCrop = {
        id: 'crop-over',
        pondId: 'pond-1',
        initialShrimpCount: 100000,
        targetSurvivalRate: 85,
        startDate: new Date('2026-01-01'),
        status: 'ACTIVE',
        pond: { name: 'Ao A1', farmId: 'farm-1' },
      };

      mockPrismaService.crop.findUnique.mockResolvedValue(mockCrop);
      mockShrimpSizeService.getCurrentShrimpCount.mockResolvedValue(120000);

      const result = await service.calculateSurvivalRate(
        { userId: 'user-1', role: 'FARM_MANAGER' },
        'crop-over',
      );

      expect(result.survivalRate).toBe(100);
    });

    it('should clamp survival rate at 0% minimum if current count is negative', async () => {
      const mockCrop = {
        id: 'crop-neg',
        pondId: 'pond-1',
        initialShrimpCount: 100000,
        targetSurvivalRate: 85,
        startDate: new Date('2026-01-01'),
        status: 'ACTIVE',
        pond: { name: 'Ao A1', farmId: 'farm-1' },
      };

      mockPrismaService.crop.findUnique.mockResolvedValue(mockCrop);
      mockShrimpSizeService.getCurrentShrimpCount.mockResolvedValue(-500);

      const result = await service.calculateSurvivalRate(
        { userId: 'user-1', role: 'FARM_MANAGER' },
        'crop-neg',
      );

      expect(result.survivalRate).toBe(0);
    });

    it('should calculate survival rate from recorded actualHarvestCount when getCurrentShrimpCount returns null', async () => {
      const mockCrop = {
        id: 'crop-2',
        pondId: 'pond-2',
        initialShrimpCount: 100000,
        actualHarvestCount: 78000,
        targetSurvivalRate: 85,
        startDate: new Date('2026-01-01'),
        status: 'HARVESTED',
        pond: { name: 'Ao A2', farmId: 'farm-1' },
      };

      mockPrismaService.crop.findUnique.mockResolvedValue(mockCrop);
      mockShrimpSizeService.getCurrentShrimpCount.mockResolvedValue(null);

      const result = await service.calculateSurvivalRate(
        { userId: 'user-1', role: 'FARM_MANAGER' },
        'crop-2',
      );

      expect(result.harvestCount).toBe(78000);
      expect(result.survivalRate).toBe(78);
      expect(result.status).toBe('WARNING');
    });

    it('should throw BadRequestException ("Chưa có dữ liệu thả giống") when stockingQuantity is 0 or missing', async () => {
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
