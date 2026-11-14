/**
 * cropCycleGrouping.ts
 *
 * Tiện ích gom nhóm các ao và dữ liệu vụ nuôi theo chu kỳ vụ (Crop Cycle)
 * Đặc biệt hỗ trợ mô hình Công nghệ cao 2 giai đoạn:
 * Ao Ương (Giai đoạn 1) ──[Tách ao / Phân bổ]──▶ Các Ao Thương phẩm (Giai đoạn 2) ──▶ Thu hoạch
 */

import { type Crop } from '../services/crop.service';

export interface FarmInfo {
  id: string;
  name: string;
  farmingModel?: string | null;
}

export interface PondInfo {
  id: string;
  name: string;
  areaSize?: number;
  depth?: number;
  farmId: string;
}

export interface SplitAllocation {
  destinationPondId: string;
  destinationPondName: string;
  areaSize?: number;
  shrimpCount: number;
  ratioPercent: number;
  isCurrentPond: boolean;
  childCropId?: string;
  targetHarvestSize?: number | null;
}

export interface CommercialPondDetail {
  crop: Crop;
  pondId: string;
  pondName: string;
  areaSize: number;
  initialShrimpCount: number;
  startDate: string;
  harvestDate?: string | null;
  durationDays: number;
  harvestKg: number;
  harvestSize: number;
  harvestCount: number;
  revenue: number;
  cost: number;
  profit: number;
  fcr: number | null;
  survivalRate: number | null;
  status: 'ACTIVE' | 'HARVESTED' | 'FAILED';
  isOriginNurseryPond: boolean;
}

export interface NurseryStageInfo {
  cropId: string;
  pondId: string;
  pondName: string;
  areaSize: number;
  startDate: string;
  transferDate?: string | null;
  durationDays: number;
  initialShrimpCount: number;
  actualNurseryHarvest?: number | null;
  nurserySurvivalRate?: number | null;
  transferSize?: number | null;
  splitNote?: string | null;
  seedCost?: number | null;
  seedUnitPrice?: number | null;
  seedType?: string | null;
  isContinuedInSamePond: boolean;
}

export interface CropCycleTotals {
  totalPondsCount: number;
  totalStockedShrimp: number;
  totalHarvestKg: number;
  totalHarvestTons: string;
  totalHarvestCount: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgFcr: number | null;
  avgHarvestSize: number | null;
  overallSurvivalRate: number | null;
}

export interface CropCycle {
  id: string;
  code: string;
  name: string;
  farmId: string;
  farmName: string;
  farmingModel: string;
  isHighTech: boolean;
  isSplit: boolean;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  startDate: string;
  endDate: string | null;
  durationDays: number;

  nurseryInfo?: NurseryStageInfo;
  splitAllocations: SplitAllocation[];
  commercialPonds: CommercialPondDetail[];
  totals: CropCycleTotals;

  rootCrop: Crop;
  allCrops: Crop[];
}

/**
 * Suy đoán tên mùa vụ thân thiện từ ngày bắt đầu
 */
function getSeasonName(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Vụ Nuôi';
    const month = d.getMonth() + 1; // 1-12
    const year = d.getFullYear();

    if (month >= 9 || month <= 11) {
      return `Vụ Thu Đông ${year}`;
    } else if (month === 12 || month <= 2) {
      return `Vụ Đông Xuân ${year}`;
    } else if (month >= 3 && month <= 5) {
      return `Vụ Xuân Hè ${year}`;
    } else {
      return `Vụ Hè Thu ${year}`;
    }
  } catch {
    return 'Vụ Nuôi';
  }
}

/**
 * Tính số ngày giữa 2 mốc thời gian
 */
function diffInDays(start: string | Date, end: string | Date): number {
  try {
    const d1 = new Date(start);
    const d2 = new Date(end);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

/**
 * Gom nhóm danh sách các vụ nuôi thành các Chu Kỳ Vụ Nuôi (Crop Cycles)
 */
export function groupCropsIntoCycles(
  allCrops: Crop[],
  farms: FarmInfo[] = [],
  ponds: PondInfo[] = []
): CropCycle[] {
  if (!allCrops || allCrops.length === 0) return [];

  const farmMap = new Map<string, FarmInfo>(farms.map((f) => [f.id, f]));
  const pondMap = new Map<string, PondInfo>(ponds.map((p) => [p.id, p]));
  const cropMap = new Map<string, Crop>(allCrops.map((c) => [c.id, c]));

  // 1. Phân loại cha - con
  // Tìm gốc (root) của từng crop
  function findRootCrop(crop: Crop): Crop {
    let curr = crop;
    const visited = new Set<string>();
    while (curr.parentCropId && cropMap.has(curr.parentCropId) && !visited.has(curr.parentCropId)) {
      visited.add(curr.id);
      curr = cropMap.get(curr.parentCropId)!;
    }
    return curr;
  }

  // Gom các crop vào từng root
  const rootGroups = new Map<string, Crop[]>();
  for (const crop of allCrops) {
    const root = findRootCrop(crop);
    if (!rootGroups.has(root.id)) {
      rootGroups.set(root.id, []);
    }
    rootGroups.get(root.id)!.push(crop);
  }

  // 2. Chuyển đổi từng nhóm root thành CropCycle
  const cycles: CropCycle[] = [];

  // Sắp xếp các nhóm theo ngày bắt đầu của ao gốc
  const sortedRootIds = Array.from(rootGroups.keys()).sort((a, b) => {
    const cropA = cropMap.get(a);
    const cropB = cropMap.get(b);
    const timeA = cropA ? new Date(cropA.startDate).getTime() : 0;
    const timeB = cropB ? new Date(cropB.startDate).getTime() : 0;
    return timeB - timeA; // Mới nhất lên trước
  });

  // Đếm thứ tự vụ theo trang trại để đặt tên "Vụ 1, Vụ 2, ..."
  const farmCycleCounter = new Map<string, number>();

  // Duyệt theo thứ tự cũ -> mới để gán số thứ tự Vụ 1, Vụ 2 chuẩn xác
  const chronologicalRootIds = [...sortedRootIds].reverse();
  const cycleIndexMap = new Map<string, number>();
  for (const rootId of chronologicalRootIds) {
    const rootCrop = cropMap.get(rootId)!;
    const farmId = rootCrop.pond?.farmId || 'unknown';
    const nextIdx = (farmCycleCounter.get(farmId) || 0) + 1;
    farmCycleCounter.set(farmId, nextIdx);
    cycleIndexMap.set(rootId, nextIdx);
  }

  for (const rootId of sortedRootIds) {
    const rootCrop = cropMap.get(rootId)!;
    const memberCrops = rootGroups.get(rootId)!;

    const farmId = rootCrop.pond?.farmId || '';
    const farm = farmMap.get(farmId) || rootCrop.pond?.farm;
    const farmName = farm?.name || rootCrop.pond?.farm?.name || 'Trang trại';
    const farmingModel = farm?.farmingModel || 'HIGH_TECH';

    // Xác định xem vụ này có tách ao hoặc là công nghệ cao không
    const hasNurseryStage =
      rootCrop.stage === 'NURSERY' ||
      !!rootCrop.actualNurseryHarvest ||
      !!rootCrop.transferDate ||
      memberCrops.some((c) => c.parentCropId === rootCrop.id);

    const isHighTech = farmingModel === 'HIGH_TECH' || hasNurseryStage;

    // Con giống thả ban đầu
    const totalStockedShrimp = rootCrop.initialShrimpCount || 0;

    // Thông tin Ao Ương
    let nurseryInfo: NurseryStageInfo | undefined = undefined;
    const splitAllocations: SplitAllocation[] = [];

    // Tìm các ao nhận tôm (child crops)
    const childCrops = memberCrops.filter((c) => c.parentCropId === rootCrop.id);
    const hasChildren = childCrops.length > 0;
    const isSplit = hasNurseryStage && (hasChildren || !!rootCrop.transferDate);

    // Kiểm tra xem ao ương có được giữ lại nuôi tiếp không
    // (nếu ao gốc có actualHarvestKg > 0 và có childCrops, hoặc nếu ao gốc tiếp tục thương phẩm)
    const isContinuedInSamePond =
      hasChildren &&
      (!!rootCrop.actualHarvestKg || rootCrop.status === 'ACTIVE') &&
      rootCrop.stage !== 'NURSERY';

    if (hasNurseryStage) {
      const nurseryPondObj = pondMap.get(rootCrop.pondId) || rootCrop.pond;
      const nurseryEndDate = rootCrop.transferDate || rootCrop.expectedTransferDate || new Date();
      const nurseryDoc = diffInDays(rootCrop.startDate, nurseryEndDate);

      nurseryInfo = {
        cropId: rootCrop.id,
        pondId: rootCrop.pondId,
        pondName: nurseryPondObj?.name || rootCrop.pond?.name || 'Ao Ương Dưỡng',
        areaSize: Number(nurseryPondObj?.areaSize || rootCrop.pond?.areaSize || 0),
        startDate: rootCrop.startDate,
        transferDate: rootCrop.transferDate || rootCrop.expectedTransferDate,
        durationDays: nurseryDoc,
        initialShrimpCount: totalStockedShrimp,
        actualNurseryHarvest: rootCrop.actualNurseryHarvest,
        nurserySurvivalRate: rootCrop.nurserySurvivalRate,
        transferSize: rootCrop.transferSize,
        splitNote: rootCrop.splitNote,
        seedCost: rootCrop.seedCost,
        seedUnitPrice: rootCrop.seedUnitPrice,
        seedType: rootCrop.seedType,
        isContinuedInSamePond,
      };

      // Xây dựng danh sách phân bổ tách ao
      const totalTransferred = rootCrop.actualNurseryHarvest || childCrops.reduce((s, c) => s + c.initialShrimpCount, 0);

      // Nếu giữ lại ao ương để nuôi tiếp
      if (isContinuedInSamePond) {
        const allocatedToChildren = childCrops.reduce((s, c) => s + c.initialShrimpCount, 0);
        const keptShrimp = Math.max(0, totalTransferred - allocatedToChildren);
        if (keptShrimp > 0) {
          splitAllocations.push({
            destinationPondId: rootCrop.pondId,
            destinationPondName: nurseryPondObj?.name || 'Ao ương (Giữ nuôi tiếp)',
            areaSize: Number(nurseryPondObj?.areaSize || 0),
            shrimpCount: keptShrimp,
            ratioPercent: totalTransferred > 0 ? Number(((keptShrimp / totalTransferred) * 100).toFixed(1)) : 0,
            isCurrentPond: true,
            childCropId: rootCrop.id,
            targetHarvestSize: rootCrop.targetHarvestSize ?? null,
          });
        }
      }

      // Các ao con tách ra
      for (const child of childCrops) {
        const childPond = pondMap.get(child.pondId) || child.pond;
        splitAllocations.push({
          destinationPondId: child.pondId,
          destinationPondName: childPond?.name || child.pond?.name || 'Ao thương phẩm',
          areaSize: Number(childPond?.areaSize || child.pond?.areaSize || 0),
          shrimpCount: child.initialShrimpCount,
          ratioPercent: totalTransferred > 0 ? Number(((child.initialShrimpCount / totalTransferred) * 100).toFixed(1)) : 0,
          isCurrentPond: child.pondId === rootCrop.pondId,
          childCropId: child.id,
          targetHarvestSize: child.targetHarvestSize ?? null,
        });
      }
    }

    // Xây dựng danh sách các ao thương phẩm (Commercial Ponds)
    const commercialPonds: CommercialPondDetail[] = [];

    // Nếu ao gốc nuôi thương phẩm (tiếp tục nuôi hoặc là vụ truyền thống/1 giai đoạn)
    const shouldIncludeRootInCommercial =
      !hasChildren ||
      isContinuedInSamePond ||
      (rootCrop.actualHarvestKg && rootCrop.actualHarvestKg > 0);

    if (shouldIncludeRootInCommercial) {
      const p = pondMap.get(rootCrop.pondId) || rootCrop.pond;
      const area = Number(p?.areaSize || rootCrop.pond?.areaSize || 0);
      const harvestDate = rootCrop.actualHarvestDate;
      const dur = harvestDate ? diffInDays(rootCrop.startDate, harvestDate) : (rootCrop.expectedDurationDays || 90);

      commercialPonds.push({
        crop: rootCrop,
        pondId: rootCrop.pondId,
        pondName: p?.name || rootCrop.pond?.name || 'Ao nuôi chính',
        areaSize: area,
        initialShrimpCount: isContinuedInSamePond && splitAllocations[0] ? splitAllocations[0].shrimpCount : rootCrop.initialShrimpCount,
        startDate: rootCrop.startDate,
        harvestDate,
        durationDays: dur,
        harvestKg: rootCrop.actualHarvestKg || 0,
        harvestSize: rootCrop.actualHarvestSize || 0,
        harvestCount: rootCrop.actualHarvestCount || (rootCrop.actualHarvestKg && rootCrop.actualHarvestSize ? Math.round(rootCrop.actualHarvestKg * rootCrop.actualHarvestSize) : 0),
        revenue: rootCrop.actualHarvestRevenue || 0,
        cost: rootCrop.actualHarvestCost || 0,
        profit: rootCrop.actualHarvestProfit !== null && rootCrop.actualHarvestProfit !== undefined
          ? rootCrop.actualHarvestProfit
          : (rootCrop.actualHarvestRevenue || 0) - (rootCrop.actualHarvestCost || 0),
        fcr: rootCrop.actualHarvestFcr ?? null,
        survivalRate: rootCrop.actualHarvestSurvivalRate ?? null,
        status: rootCrop.status,
        isOriginNurseryPond: hasNurseryStage,
      });
    }

    // Thêm các ao con sau tách
    for (const child of childCrops) {
      const p = pondMap.get(child.pondId) || child.pond;
      const area = Number(p?.areaSize || child.pond?.areaSize || 0);
      const harvestDate = child.actualHarvestDate;
      const dur = harvestDate ? diffInDays(child.startDate, harvestDate) : (child.expectedDurationDays || 70);

      commercialPonds.push({
        crop: child,
        pondId: child.pondId,
        pondName: p?.name || child.pond?.name || 'Ao thương phẩm',
        areaSize: area,
        initialShrimpCount: child.initialShrimpCount,
        startDate: child.startDate,
        harvestDate,
        durationDays: dur,
        harvestKg: child.actualHarvestKg || 0,
        harvestSize: child.actualHarvestSize || 0,
        harvestCount: child.actualHarvestCount || (child.actualHarvestKg && child.actualHarvestSize ? Math.round(child.actualHarvestKg * child.actualHarvestSize) : 0),
        revenue: child.actualHarvestRevenue || 0,
        cost: child.actualHarvestCost || 0,
        profit: child.actualHarvestProfit !== null && child.actualHarvestProfit !== undefined
          ? child.actualHarvestProfit
          : (child.actualHarvestRevenue || 0) - (child.actualHarvestCost || 0),
        fcr: child.actualHarvestFcr ?? null,
        survivalRate: child.actualHarvestSurvivalRate ?? null,
        status: child.status,
        isOriginNurseryPond: false,
      });
    }

    // Tính toán tổng kết toàn vụ (Overall Totals)
    const totalHarvestKg = commercialPonds.reduce((s, cp) => s + cp.harvestKg, 0);
    const totalHarvestCount = commercialPonds.reduce((s, cp) => s + cp.harvestCount, 0);
    const totalRevenue = commercialPonds.reduce((s, cp) => s + cp.revenue, 0);
    const totalCost = commercialPonds.reduce((s, cp) => s + cp.cost, 0);
    const totalProfit = commercialPonds.reduce((s, cp) => s + cp.profit, 0);

    // Tính weighted FCR
    let weightedFcrSum = 0;
    let totalFcrKg = 0;
    for (const cp of commercialPonds) {
      if (cp.fcr && cp.harvestKg > 0) {
        weightedFcrSum += cp.fcr * cp.harvestKg;
        totalFcrKg += cp.harvestKg;
      }
    }
    const avgFcr = totalFcrKg > 0 ? Number((weightedFcrSum / totalFcrKg).toFixed(2)) : null;

    // Tính weighted Harvest Size
    const avgHarvestSize = totalHarvestKg > 0 && totalHarvestCount > 0
      ? Number((totalHarvestCount / totalHarvestKg).toFixed(1))
      : null;

    // Tỷ lệ sống tổng thể từ thả giống đến thu hoạch
    const overallSurvivalRate = totalStockedShrimp > 0 && totalHarvestCount > 0
      ? Number(((totalHarvestCount / totalStockedShrimp) * 100).toFixed(1))
      : null;

    // Trạng thái vụ
    let status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' = 'COMPLETED';
    const anyActive = memberCrops.some((c) => c.status === 'ACTIVE');
    const allFailed = memberCrops.every((c) => c.status === 'FAILED');

    if (anyActive) {
      status = 'IN_PROGRESS';
    } else if (allFailed) {
      status = 'FAILED';
    } else {
      status = 'COMPLETED';
    }

    // Thời gian kết thúc vụ: ngày thu hoạch muộn nhất
    let latestEndDate: string | null = null;
    for (const c of memberCrops) {
      const d = c.actualHarvestDate || c.transferDate;
      if (d) {
        if (!latestEndDate || new Date(d).getTime() > new Date(latestEndDate).getTime()) {
          latestEndDate = d;
        }
      }
    }

    const durationDays = latestEndDate
      ? diffInDays(rootCrop.startDate, latestEndDate)
      : (rootCrop.expectedDurationDays || 90);

    // Đặt tên vụ thông minh
    const cycleIndex = cycleIndexMap.get(rootId) || 1;
    const seasonName = getSeasonName(rootCrop.startDate);
    const cycleName = `Vụ ${cycleIndex}: ${seasonName}`;
    const startYear = new Date(rootCrop.startDate).getFullYear() || 2026;
    const cycleCode = `VU-${startYear}-0${cycleIndex}`;

    // Đếm tổng số ao tham gia
    const uniquePondIds = new Set(memberCrops.map((c) => c.pondId));

    cycles.push({
      id: rootCrop.id,
      code: cycleCode,
      name: cycleName,
      farmId,
      farmName,
      farmingModel,
      isHighTech,
      isSplit,
      status,
      startDate: rootCrop.startDate,
      endDate: latestEndDate,
      durationDays,
      nurseryInfo,
      splitAllocations,
      commercialPonds,
      totals: {
        totalPondsCount: uniquePondIds.size,
        totalStockedShrimp,
        totalHarvestKg,
        totalHarvestTons: (totalHarvestKg / 1000).toFixed(2),
        totalHarvestCount,
        totalRevenue,
        totalCost,
        totalProfit,
        avgFcr,
        avgHarvestSize,
        overallSurvivalRate,
      },
      rootCrop,
      allCrops: memberCrops,
    });
  }

  return cycles;
}
