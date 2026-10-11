require('dotenv/config');

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const MANAGER_EMAIL = 'tdv14112004@gmail.com';
const DAY_MS = 86_400_000;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const daysAgo = (days, hour = 7) => {
  const date = new Date(Date.now() - days * DAY_MS);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

const formatNumber = (value, digits = 1) => new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: digits,
}).format(value);

const createSeedReview = (harvest, initialShrimpCount, previousHarvest) => {
  const targetSurvivalRate = 78;
  const targetHarvestSize = 40;
  const targetHarvestKg = initialShrimpCount * (targetSurvivalRate / 100) / targetHarvestSize;
  const productionChange = ((harvest.actualHarvestKg - targetHarvestKg) / targetHarvestKg) * 100;
  const margin = harvest.actualHarvestProfit / harvest.actualHarvestRevenue * 100;
  const evaluation = `Vụ nuôi thu ${formatNumber(harvest.actualHarvestKg)} kg, doanh thu ${formatNumber(harvest.actualHarvestRevenue, 0)} đ, lợi nhuận ${formatNumber(harvest.actualHarvestProfit, 0)} đ và biên lợi nhuận ${formatNumber(margin)}%. Sản lượng ${productionChange >= 0 ? 'vượt' : 'thấp hơn'} mục tiêu ${formatNumber(Math.abs(productionChange))}% (${formatNumber(targetHarvestKg)} kg). Tỷ lệ sống đạt ${formatNumber(harvest.actualHarvestSurvivalRate)}%, ${harvest.actualHarvestSurvivalRate >= targetSurvivalRate ? 'tăng' : 'giảm'} ${formatNumber(Math.abs(harvest.actualHarvestSurvivalRate - targetSurvivalRate))} điểm phần trăm so với mục tiêu ${targetSurvivalRate}%. FCR thực tế là ${formatNumber(harvest.actualHarvestFcr, 2)}.`;

  if (!previousHarvest) {
    return {
      evaluation,
      lessonsLearned: 'Chưa có vụ thu hoạch trước cùng ao để đối chiếu. Kết quả này sẽ được dùng làm mốc tham chiếu cho vụ tiếp theo.',
      nextRecommendation: 'Dùng kết quả vụ này làm mốc tham chiếu và tiếp tục duy trì quy trình đang có dữ liệu chứng minh hiệu quả. Khuyến nghị cần được quản lý xác nhận cùng nhật ký thực địa trước khi áp dụng.',
    };
  }

  const profitChange = ((harvest.actualHarvestProfit - previousHarvest.actualHarvestProfit) / previousHarvest.actualHarvestProfit) * 100;
  const fcrDifference = harvest.actualHarvestFcr - previousHarvest.actualHarvestFcr;
  const survivalDifference = harvest.actualHarvestSurvivalRate - previousHarvest.actualHarvestSurvivalRate;
  const lessonsLearned = `So với vụ thu hoạch gần nhất cùng ao: lợi nhuận ${profitChange >= 0 ? 'tăng' : 'giảm'} ${formatNumber(Math.abs(profitChange))}%; FCR ${fcrDifference <= 0 ? 'cải thiện' : 'tăng'} ${formatNumber(Math.abs(fcrDifference), 2)}; tỷ lệ sống ${survivalDifference >= 0 ? 'tăng' : 'giảm'} ${formatNumber(Math.abs(survivalDifference))} điểm phần trăm. Đây là biến động số liệu, chưa đủ để kết luận nguyên nhân nếu không có nhật ký vận hành liên quan.`;
  const needsReview = harvest.actualHarvestSurvivalRate < targetSurvivalRate || fcrDifference > 0;
  const nextRecommendation = needsReview
    ? 'Đối chiếu nhật ký môi trường, dịch bệnh, cho ăn và sinh khối trước khi điều chỉnh vụ tiếp theo. Khuyến nghị cần được quản lý xác nhận cùng nhật ký thực địa trước khi áp dụng.'
    : 'Dùng kết quả vụ này làm mốc tham chiếu và tiếp tục duy trì quy trình đang có dữ liệu chứng minh hiệu quả. Khuyến nghị cần được quản lý xác nhận cùng nhật ký thực địa trước khi áp dụng.';
  return { evaluation, lessonsLearned, nextRecommendation };
};

async function main() {
  const manager = await prisma.user.findUnique({
    where: { email: MANAGER_EMAIL },
    include: {
      farms: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  if (!manager || manager.role !== 'FARM_MANAGER') {
    throw new Error(`Không tìm thấy tài khoản FARM_MANAGER ${MANAGER_EMAIL}`);
  }
  const farm = manager.farms[0];
  if (!farm) throw new Error(`Tài khoản ${MANAGER_EMAIL} chưa có trang trại`);

  const technician = await prisma.user.upsert({
    where: { email: 'demo.technician.dashboard@ssfm.local' },
    update: { fullName: 'Kỹ thuật viên Demo Dashboard', role: 'TECHNICIAN', isActive: true },
    create: {
      email: 'demo.technician.dashboard@ssfm.local',
      fullName: 'Kỹ thuật viên Demo Dashboard',
      role: 'TECHNICIAN',
      isActive: true,
    },
  });
  await prisma.farmStaff.upsert({
    where: { farmId_userId: { farmId: farm.id, userId: technician.id } },
    update: { role: 'TECHNICIAN', isActive: true },
    create: { farmId: farm.id, userId: technician.id, role: 'TECHNICIAN' },
  });

  const ponds = [
    { id: 'd0000000-0000-4000-8000-000000000001', name: 'Demo Dashboard - Ao ổn định', areaSize: 1200, depth: 1.6 },
    { id: 'd0000000-0000-4000-8000-000000000002', name: 'Demo Dashboard - Ao cần chú ý', areaSize: 1100, depth: 1.5 },
    { id: 'd0000000-0000-4000-8000-000000000003', name: 'Demo Dashboard - Ao cảnh báo', areaSize: 1000, depth: 1.4 },
    { id: 'd0000000-0000-4000-8000-000000000004', name: 'Demo Dashboard - Ao lịch sử', areaSize: 900, depth: 1.5 },
  ];
  for (const pond of ponds) {
    await prisma.pond.upsert({
      where: { id: pond.id },
      update: { ...pond, farmId: farm.id },
      create: { ...pond, farmId: farm.id },
    });
  }

  const activeCrops = [
    { id: 'c0000000-0000-4000-8000-000000000001', pondId: ponds[0].id, startDate: daysAgo(72), initialShrimpCount: 180000, targetHarvestSize: 35, targetSurvivalRate: 82, targetTotalFeedKg: 5400, expectedDurationDays: 120 },
    { id: 'c0000000-0000-4000-8000-000000000002', pondId: ponds[1].id, startDate: daysAgo(54), initialShrimpCount: 160000, targetHarvestSize: 38, targetSurvivalRate: 80, targetTotalFeedKg: 4600, expectedDurationDays: 115 },
    { id: 'c0000000-0000-4000-8000-000000000003', pondId: ponds[2].id, startDate: daysAgo(39), initialShrimpCount: 140000, targetHarvestSize: 40, targetSurvivalRate: 78, targetTotalFeedKg: 3900, expectedDurationDays: 110 },
  ];
  for (const crop of activeCrops) {
    const data = {
      ...crop,
      status: 'ACTIVE',
      stage: 'COMMERCIAL',
      expectedHarvestDate: new Date(crop.startDate.getTime() + crop.expectedDurationDays * DAY_MS),
      growthMilestones: [
        { day: 30, weight: 5 },
        { day: 60, weight: 14 },
        { day: 90, weight: 23 },
        { day: crop.expectedDurationDays, weight: 29 },
      ],
    };
    await prisma.crop.upsert({ where: { id: crop.id }, update: data, create: data });
  }

  const currentYear = new Date().getUTCFullYear();
  const harvests = [
    { id: 'c0000000-0000-4000-8000-000000000011', actualHarvestDate: daysAgo(48), actualHarvestKg: 4100, actualHarvestRevenue: 574000000, actualHarvestCost: 391000000, actualHarvestProfit: 183000000, actualHarvestFcr: 1.28, actualHarvestSurvivalRate: 84 },
    { id: 'c0000000-0000-4000-8000-000000000012', actualHarvestDate: new Date(Date.UTC(currentYear, 3, 18, 7)), actualHarvestKg: 3650, actualHarvestRevenue: 492750000, actualHarvestCost: 356000000, actualHarvestProfit: 136750000, actualHarvestFcr: 1.35, actualHarvestSurvivalRate: 79 },
    { id: 'c0000000-0000-4000-8000-000000000013', actualHarvestDate: new Date(Date.UTC(currentYear - 1, 8, 12, 7)), actualHarvestKg: 3380, actualHarvestRevenue: 439400000, actualHarvestCost: 341000000, actualHarvestProfit: 98400000, actualHarvestFcr: 1.42, actualHarvestSurvivalRate: 76 },
  ];
  for (const [index, harvest] of harvests.entries()) {
    const startDate = new Date(harvest.actualHarvestDate.getTime() - 118 * DAY_MS);
    const initialShrimpCount = 170000 - index * 5000;
    const actualHarvestCount = Math.round(initialShrimpCount * harvest.actualHarvestSurvivalRate / 100);
    const generatedReview = createSeedReview(harvest, initialShrimpCount, harvests[index + 1] || null);
    const data = {
      ...harvest,
      pondId: ponds[3].id,
      startDate,
      initialShrimpCount,
      status: 'HARVESTED',
      stage: 'COMMERCIAL',
      targetHarvestSize: 40,
      targetSurvivalRate: 78,
      targetTotalFeedKg: 4800,
      expectedDurationDays: 115,
      expectedHarvestDate: new Date(startDate.getTime() + 115 * DAY_MS),
      actualHarvestCount,
      actualHarvestSize: Number((actualHarvestCount / harvest.actualHarvestKg).toFixed(2)),
      actualHarvestPricePerKg: Math.round(harvest.actualHarvestRevenue / harvest.actualHarvestKg),
      harvestFeedCost: Math.round(harvest.actualHarvestCost * 0.58),
      harvestMedicineCost: Math.round(harvest.actualHarvestCost * 0.08),
      harvestChemicalCost: Math.round(harvest.actualHarvestCost * 0.07),
      harvestSeedCost: Math.round(harvest.actualHarvestCost * 0.1),
      harvestElectricityCost: Math.round(harvest.actualHarvestCost * 0.07),
      harvestLaborCost: Math.round(harvest.actualHarvestCost * 0.06),
      harvestOtherCost: Math.round(harvest.actualHarvestCost * 0.04),
      harvestFeedKg: Math.round(harvest.actualHarvestKg * harvest.actualHarvestFcr),
      harvestNote: 'Dữ liệu mẫu phục vụ kiểm tra Dashboard quản lý',
      harvestEvaluation: generatedReview.evaluation,
      harvestLessonsLearned: generatedReview.lessonsLearned,
      harvestNextRecommendation: generatedReview.nextRecommendation,
    };
    await prisma.crop.upsert({ where: { id: harvest.id }, update: data, create: data });
  }

  const samples = [
    { id: 'b0000000-0000-4000-8000-000000000001', pondId: ponds[0].id, crop: activeCrops[0], abw: 15.8, biomass: 2380, total: 150600 },
    { id: 'b0000000-0000-4000-8000-000000000002', pondId: ponds[1].id, crop: activeCrops[1], abw: 11.6, biomass: 1485, total: 128000 },
    { id: 'b0000000-0000-4000-8000-000000000003', pondId: ponds[2].id, crop: activeCrops[2], abw: 7.9, biomass: 860, total: 108900 },
  ];
  for (const sample of samples) {
    const doc = Math.floor((Date.now() - sample.crop.startDate.getTime()) / DAY_MS);
    const data = {
      pondId: sample.pondId,
      samplingDate: daysAgo(1, 8),
      doc,
      sampleCount: 100,
      sampleWeightGram: sample.abw * 100,
      sampleLengthCm: 9.5,
      abwGram: sample.abw,
      sizePerKg: Number((1000 / sample.abw).toFixed(2)),
      adgGramPerDay: Number((sample.abw / doc).toFixed(2)),
      netAreaSqM: 25,
      estimatedTotalShrimp: sample.total,
      estimatedBiomassKg: sample.biomass,
      notes: 'Dữ liệu mẫu Dashboard quản lý',
    };
    await prisma.shrimpSizeSample.upsert({
      where: { id: sample.id },
      update: data,
      create: { id: sample.id, ...data },
    });
  }

  const waterProfiles = [
    { pondId: ponds[0].id, doValues: [5.7, 5.9, 6, 5.8, 6.1, 6, 6.2], phValues: [7.8, 7.9, 8, 8.1, 8, 7.9, 8] },
    { pondId: ponds[1].id, doValues: [5.3, 5.1, 5, 4.9, 4.8, 4.7, 4.6], phValues: [8.1, 8.2, 8.2, 8.4, 8.5, 8.6, 8.7] },
    { pondId: ponds[2].id, doValues: [5.2, 4.9, 4.7, 4.4, 4.1, 3.8, 3.4], phValues: [7.8, 7.7, 7.5, 7.3, 7.1, 6.9, 6.8] },
  ];
  for (const [pondIndex, profile] of waterProfiles.entries()) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const id = `a${pondIndex + 1}000000-0000-4000-8000-${String(dayIndex + 1).padStart(12, '0')}`;
      const data = {
        pondId: profile.pondId,
        recordTime: daysAgo(6 - dayIndex, 6),
        temperature: 28.2 + pondIndex * 0.5 + dayIndex * 0.1,
        ph: profile.phValues[dayIndex],
        dissolvedOxygen: profile.doValues[dayIndex],
        salinity: 14.5 + pondIndex,
        alkalinity: 118 - pondIndex * 5,
        nh3: pondIndex === 2 ? 0.18 : 0.04 + pondIndex * 0.03,
        no2: pondIndex === 2 ? 0.45 : 0.08 + pondIndex * 0.05,
        h2s: pondIndex === 2 ? 0.06 : 0.01,
        transparency: 34 - pondIndex * 3,
        waterColor: pondIndex === 2 ? 'Nâu đậm' : 'Xanh nhạt',
        note: 'Dữ liệu mẫu Dashboard quản lý',
        createdBy: technician.id,
      };
      await prisma.waterQualityRecord.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
  }

  const incidents = [
    { id: 'e0000000-0000-4000-8000-000000000001', cropId: activeCrops[2].id, title: 'Demo Dashboard - Oxy hòa tan giảm nhanh', description: 'DO giảm dưới ngưỡng an toàn, cần tăng cường quạt nước và theo dõi liên tục.', status: 'OPEN', treatment: null, startedAt: null, resolvedAt: null },
    { id: 'e0000000-0000-4000-8000-000000000002', cropId: activeCrops[1].id, title: 'Demo Dashboard - pH có xu hướng tăng', description: 'pH tăng dần trong ba ngày gần nhất, cần kiểm tra tảo và độ kiềm.', status: 'TREATING', treatment: 'Giảm 20% lượng thức ăn, thay nước từng phần và kiểm tra lại sau 4 giờ.', startedAt: daysAgo(1, 3), resolvedAt: null },
    { id: 'e0000000-0000-4000-8000-000000000003', cropId: activeCrops[0].id, title: 'Demo Dashboard - Độ trong thấp', description: 'Độ trong thấp hơn kế hoạch nhưng đã được xử lý ổn định.', status: 'RESOLVED', treatment: 'Điều chỉnh lượng thức ăn và thay 10% nước ao.', startedAt: daysAgo(5, 3), resolvedAt: daysAgo(3, 10) },
  ];
  for (const incident of incidents) {
    const data = { ...incident, reporterId: manager.id, assignedToId: technician.id };
    await prisma.incident.upsert({ where: { id: incident.id }, update: data, create: data });
  }

  await prisma.incidentTreatmentUpdate.upsert({
    where: { id: 'f0000000-0000-4000-8000-000000000001' },
    update: {
      treatment: incidents[1].treatment,
      observation: 'pH đã giảm nhẹ, tôm hoạt động bình thường.',
      result: 'Tiếp tục theo dõi trong 24 giờ.',
      status: 'TREATING',
    },
    create: {
      id: 'f0000000-0000-4000-8000-000000000001',
      incidentId: incidents[1].id,
      authorId: technician.id,
      treatment: incidents[1].treatment,
      observation: 'pH đã giảm nhẹ, tôm hoạt động bình thường.',
      result: 'Tiếp tục theo dõi trong 24 giờ.',
      status: 'TREATING',
      eventType: 'TREATMENT',
    },
  });

  console.log(JSON.stringify({
    manager: manager.email,
    farm: farm.name,
    ponds: ponds.length,
    activeCrops: activeCrops.length,
    harvestedCrops: harvests.length,
    waterRecords: waterProfiles.length * 7,
    incidents: incidents.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
