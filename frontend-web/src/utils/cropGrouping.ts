import type { Crop } from '../services/crop.service';

export interface SeasonGroup {
  seasonNumber: number; // 1, 2, 3, 4
  seasonName: string; // "Vụ 1", "Vụ 2", "Vụ 3", "Vụ 4"
  rootCropId: string; // ID of nursery / root crop
  crops: Crop[]; // All crops in this season (nursery + commercial child crops)
  cropIds: string[]; // List of all crop IDs in this season
  pondIds: string[]; // List of all pond IDs in this season
  pondNames: string[]; // Formatted list of unique pond names e.g. ["Ao nuôi A1", "Ao nuôi A2", "Ao nuôi A3"]
  startDate: string; // Earliest start date ISO string
  endDate?: string | null; // Latest harvest date or null if ongoing
  status: 'ACTIVE' | 'HARVESTED' | 'FAILED'; // ACTIVE if any crop is active
  farmId?: string;
  farmName?: string;
  displayLabel: string; // Formatted text for select dropdown
}

/**
 * Finds the root crop ID for a given crop (nursery root or self if standalone).
 */
export function getRootCropId(crop: Crop, allCrops?: Crop[]): string {
  if (!crop.parentCropId) return crop.id;
  if (allCrops && allCrops.length > 0) {
    const parent = allCrops.find((c) => c.id === crop.parentCropId);
    if (parent && parent.parentCropId) {
      return getRootCropId(parent, allCrops);
    }
  }
  return crop.parentCropId;
}

/**
 * Groups a flat list of crops into distinct Seasons (Vụ nuôi 2 giai đoạn).
 *
 * Rules:
 * 1. Ao ươm và các ao nuôi con tách ra từ nó (ao ươm A1 -> ao nuôi A1, A2, A3) gom thành 1 Vụ duy nhất.
 * 2. Đánh số Vụ theo thứ tự thời gian tăng dần: Vụ nuôi đầu tiên (2025) là Vụ 1, kế tiếp là Vụ 2, Vụ 3, Vụ 4...
 * 3. Trả về danh sách SeasonGroup đã được sắp xếp (mặc định 'asc': Vụ 1 -> Vụ 4).
 */
export function groupCropsIntoSeasons(
  crops: Crop[],
  options?: {
    sortOrder?: 'asc' | 'desc';
    farmId?: string;
    pondId?: string;
    year?: string | number;
  }
): SeasonGroup[] {
  if (!crops || crops.length === 0) return [];

  // 1. Group crops by rootCropId
  const groupsMap = new Map<string, Crop[]>();

  crops.forEach((crop) => {
    const rootId = getRootCropId(crop, crops);
    if (!groupsMap.has(rootId)) {
      groupsMap.set(rootId, []);
    }
    groupsMap.get(rootId)!.push(crop);
  });

  // 2. Build initial Season objects
  const rawSeasons: Array<{
    rootCropId: string;
    crops: Crop[];
    earliestStartTime: number;
    earliestStartDate: string;
    latestHarvestDate: string | null;
    status: 'ACTIVE' | 'HARVESTED' | 'FAILED';
    pondIds: string[];
    pondNames: string[];
    farmId?: string;
    farmName?: string;
  }> = [];

  groupsMap.forEach((groupCrops, rootId) => {
    // Determine earliest start date
    let earliestTime = Infinity;
    let earliestDateStr = '';
    let latestHarvestTime = -Infinity;
    let latestHarvestDateStr: string | null = null;
    let hasActive = false;
    let hasFailed = false;

    const pondIdSet = new Set<string>();
    const pondNameSet = new Set<string>();
    let farmId: string | undefined;
    let farmName: string | undefined;

    groupCrops.forEach((c) => {
      if (c.startDate) {
        const t = new Date(c.startDate).getTime();
        if (!isNaN(t) && t < earliestTime) {
          earliestTime = t;
          earliestDateStr = c.startDate;
        }
      }

      if (c.status === 'ACTIVE') {
        hasActive = true;
      } else if (c.status === 'FAILED') {
        hasFailed = true;
      }

      if (c.actualHarvestDate) {
        const ht = new Date(c.actualHarvestDate).getTime();
        if (!isNaN(ht) && ht > latestHarvestTime) {
          latestHarvestTime = ht;
          latestHarvestDateStr = c.actualHarvestDate;
        }
      }

      if (c.pondId) {
        pondIdSet.add(c.pondId);
      }
      if (c.pond?.name) {
        pondNameSet.add(c.pond.name);
      }
      if (!farmId && c.pond?.farmId) {
        farmId = c.pond.farmId;
      }
      if (!farmName && c.pond?.farm?.name) {
        farmName = c.pond.farm.name;
      }
    });

    const overallStatus: 'ACTIVE' | 'HARVESTED' | 'FAILED' = hasActive
      ? 'ACTIVE'
      : hasFailed && groupCrops.every((c) => c.status === 'FAILED')
      ? 'FAILED'
      : 'HARVESTED';

    rawSeasons.push({
      rootCropId: rootId,
      crops: groupCrops,
      earliestStartTime: earliestTime === Infinity ? 0 : earliestTime,
      earliestStartDate: earliestDateStr,
      latestHarvestDate: hasActive ? null : latestHarvestDateStr,
      status: overallStatus,
      pondIds: Array.from(pondIdSet),
      pondNames: Array.from(pondNameSet),
      farmId,
      farmName,
    });
  });

  // 3. Sort chronologically ASCENDING to assign correct Season numbers (2025 is Vụ 1)
  rawSeasons.sort((a, b) => a.earliestStartTime - b.earliestStartTime);

  // 4. Assign seasonNumber: 1, 2, 3, 4... and build display label
  const seasons: SeasonGroup[] = rawSeasons.map((raw, idx) => {
    const seasonNumber = idx + 1;
    const seasonName = `Vụ ${seasonNumber}`;

    const startDateFormatted = raw.earliestStartDate
      ? new Date(raw.earliestStartDate).toLocaleDateString('vi-VN')
      : '';
    const statusBadge =
      raw.status === 'ACTIVE'
        ? '🟢 Đang nuôi'
        : raw.status === 'FAILED'
        ? '🔴 Thất bại'
        : '⚪ Đã thu';

    // Format unique pond list (e.g. "Ao A1, Ao A2, Ao A3")
    const pondsStr = raw.pondNames.length > 0 ? raw.pondNames.join(', ') : 'Ao nuôi';

    const displayLabel = `${seasonName} (${startDateFormatted}) [${statusBadge}] · ${pondsStr}`;

    const cropIdsSet = new Set<string>();
    cropIdsSet.add(raw.rootCropId);
    raw.crops.forEach((c) => cropIdsSet.add(c.id));

    return {
      seasonNumber,
      seasonName,
      rootCropId: raw.rootCropId,
      crops: raw.crops,
      cropIds: Array.from(cropIdsSet),
      pondIds: raw.pondIds,
      pondNames: raw.pondNames,
      startDate: raw.earliestStartDate,
      endDate: raw.latestHarvestDate,
      status: raw.status,
      farmId: raw.farmId,
      farmName: raw.farmName,
      displayLabel,
    };
  });

  // 5. Apply filters if requested
  let filtered = seasons;

  if (options?.farmId) {
    filtered = filtered.filter(
      (s) => !s.farmId || s.farmId === options.farmId
    );
  }

  if (options?.pondId && options.pondId !== 'ALL') {
    filtered = filtered.filter((s) => s.pondIds.includes(options.pondId!));
  }

  if (options?.year && options.year !== 'ALL') {
    const yr = String(options.year);
    filtered = filtered.filter((s) => {
      const startY = s.startDate ? String(new Date(s.startDate).getFullYear()) : '';
      const endY = s.endDate ? String(new Date(s.endDate).getFullYear()) : startY;
      return yr === startY || yr === endY;
    });
  }

  // 6. Sort order for presentation
  const sortOrder = options?.sortOrder || 'asc';
  if (sortOrder === 'desc') {
    filtered = [...filtered].sort((a, b) => b.seasonNumber - a.seasonNumber);
  } else {
    filtered = [...filtered].sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  return filtered;
}

/**
 * Helper to find which season a cropId belongs to.
 */
export function findSeasonByCropId(
  seasons: SeasonGroup[],
  cropId?: string | null
): SeasonGroup | undefined {
  if (!cropId || cropId === 'ALL') return undefined;
  return seasons.find(
    (s) => s.rootCropId === cropId || s.cropIds.includes(cropId)
  );
}
