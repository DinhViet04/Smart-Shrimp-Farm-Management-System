require('dotenv/config');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY_MS = 86_400_000;
const parseDate = (dStr) => new Date(dStr + 'T07:00:00.000Z');
const addDays = (baseDate, days, hour = 7, minute = 0) => {
  const d = new Date(baseDate.getTime() + days * DAY_MS);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
};

// UUIDs xác định cho các thực thể cốt lõi
const FARM_ID = 'f0000000-0000-4000-8000-000000000090';
const SUPPLIER_ID = 's0000000-0000-4000-8000-000000000001';

const POND_IDS = {
  A1: 'p0000000-0000-4000-8000-000000000001',
  A2: 'p0000000-0000-4000-8000-000000000002',
  A3: 'p0000000-0000-4000-8000-000000000003',
  B1: 'p0000000-0000-4000-8000-000000000004',
  B2: 'p0000000-0000-4000-8000-000000000005',
  B3: 'p0000000-0000-4000-8000-000000000006',
};

// Định dạng tiền tệ VND
const formatVND = (num) => new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';

async function main() {
  console.log('========================================================================');
  console.log('🌱 BẮT ĐẦU NẠP DỮ LIỆU MẪU TOÀN DIỆN 4 VỤ NUÔI TÔM CÔNG NGHỆ CAO 5T');
  console.log('   + 01 VỤ ƯƠNG MỚI TẠI AO B1 (20 NGÀY NUÔI - SẴN SÀNG TÁCH AO)');
  console.log('========================================================================');

  const startTime = Date.now();
  const defaultHashedPassword = await bcrypt.hash('Password123@', 10);

  // ---------------------------------------------------------------------------
  // BƯỚC 1: KHỞI TẠO 4 TÀI KHOẢN NGƯỜI DÙNG CHUẨN (USERS)
  // ---------------------------------------------------------------------------
  console.log('\n[1/12] 👥 Khởi tạo & phân quyền 4 tài khoản người dùng...');

  // 1. Quản lý trang trại (FARM_MANAGER)
  const manager = await prisma.user.upsert({
    where: { email: 'hungncqde180400@fpt.edu.vn' },
    update: {
      role: 'FARM_MANAGER',
      fullName: 'Nguyễn Công Quốc Hưng',
      phone: '0901234567',
      isActive: true,
      password: defaultHashedPassword,
    },
    create: {
      email: 'hungncqde180400@fpt.edu.vn',
      fullName: 'Nguyễn Công Quốc Hưng',
      role: 'FARM_MANAGER',
      phone: '0901234567',
      password: defaultHashedPassword,
      isActive: true,
    },
  });

  // 2. Kỹ thuật viên nuôi trồng (TECHNICIAN)
  const technician = await prisma.user.upsert({
    where: { email: 'hoangtlpde180410@fpt.edu.vn' },
    update: {
      role: 'TECHNICIAN',
      fullName: 'RyuuTran',
      phone: '0912345678',
      isActive: true,
      password: defaultHashedPassword,
    },
    create: {
      email: 'hoangtlpde180410@fpt.edu.vn',
      fullName: 'RyuuTran',
      role: 'TECHNICIAN',
      phone: '0912345678',
      password: defaultHashedPassword,
      isActive: true,
    },
  });

  // 3. Nông dân vận hành ao (FARMER)
  const farmer = await prisma.user.upsert({
    where: { email: 'phucpvde180394@fpt.edu.vn' },
    update: {
      role: 'FARMER',
      fullName: 'Phan Vĩnh Phúc',
      phone: '0987654321',
      isActive: true,
      password: defaultHashedPassword,
    },
    create: {
      email: 'phucpvde180394@fpt.edu.vn',
      fullName: 'Phan Vĩnh Phúc',
      role: 'FARMER',
      phone: '0987654321',
      password: defaultHashedPassword,
      isActive: true,
    },
  });

  // 4. Quản trị viên hệ thống (ADMIN)
  const admin = await prisma.user.upsert({
    where: { email: 'ssfmsystem@gmail.com' },
    update: {
      role: 'ADMIN',
      fullName: 'SSFM-Admin',
      phone: '0945612345',
      isActive: true,
      password: defaultHashedPassword,
    },
    create: {
      email: 'ssfmsystem@gmail.com',
      fullName: 'SSFM-Admin',
      role: 'ADMIN',
      phone: '0945612345',
      password: defaultHashedPassword,
      isActive: true,
    },
  });

  console.log(`  ✔ FARM_MANAGER : ${manager.email} (${manager.fullName})`);
  console.log(`  ✔ TECHNICIAN   : ${technician.email} (${technician.fullName})`);
  console.log(`  ✔ FARMER       : ${farmer.email} (${farmer.fullName})`);
  console.log(`  ✔ ADMIN        : ${admin.email} (${admin.fullName})`);

  // ---------------------------------------------------------------------------
  // BƯỚC 2: KHỞI TẠO TRANG TRẠI & PHÂN QUYỀN NHÂN SỰ (FARM & FARM STAFF)
  // ---------------------------------------------------------------------------
  console.log('\n[2/12] 🏡 Khởi tạo trang trại Hoàng Anh Long và phân quyền nhân sự...');

  const farm = await prisma.farm.upsert({
    where: { id: FARM_ID },
    update: {
      name: 'Hoàng Anh Long',
      address: 'Xã Long Điền Tây, Huyện Đông Hải, Tỉnh Bạc Liêu',
      location: 'Bạc Liêu, Việt Nam',
      area: 10000,
      farmingModel: 'HIGH_TECH',
      ownerId: manager.id,
      status: 'ACTIVE',
      description: 'Trang trại nuôi tôm thẻ chân trắng công nghệ cao theo quy trình Thuận Thiên 5T.',
    },
    create: {
      id: FARM_ID,
      name: 'Hoàng Anh Long',
      address: 'Xã Long Điền Tây, Huyện Đông Hải, Tỉnh Bạc Liêu',
      location: 'Bạc Liêu, Việt Nam',
      area: 10000,
      farmingModel: 'HIGH_TECH',
      ownerId: manager.id,
      status: 'ACTIVE',
      description: 'Trang trại nuôi tôm thẻ chân trắng công nghệ cao theo quy trình Thuận Thiên 5T.',
    },
  });

  await prisma.farmStaff.upsert({
    where: { farmId_userId: { farmId: farm.id, userId: technician.id } },
    update: { role: 'TECHNICIAN', isActive: true },
    create: { farmId: farm.id, userId: technician.id, role: 'TECHNICIAN', isActive: true },
  });

  await prisma.farmStaff.upsert({
    where: { farmId_userId: { farmId: farm.id, userId: farmer.id } },
    update: { role: 'FARMER', isActive: true },
    create: { farmId: farm.id, userId: farmer.id, role: 'FARMER', isActive: true },
  });

  console.log(`  ✔ Trang trại: ${farm.name} (Chủ trang trại: ${manager.fullName})`);
  console.log(`  ✔ Đã gán Kỹ thuật viên & Nông dân vào trang trại.`);

  // ---------------------------------------------------------------------------
  // BƯỚC 3: KHỞI TẠO HỆ THỐNG 6 AO NUÔI (PONDS)
  // ---------------------------------------------------------------------------
  console.log('\n[3/12] 🌊 Khởi tạo hệ thống 6 ao nuôi công nghệ cao...');

  const pondsData = [
    { id: POND_IDS.A1, name: 'Ao nuôi A1', areaSize: 2000, depth: 1.5, farmId: farm.id },
    { id: POND_IDS.A2, name: 'Ao nuôi A2', areaSize: 2000, depth: 1.5, farmId: farm.id },
    { id: POND_IDS.A3, name: 'Ao nuôi A3', areaSize: 2000, depth: 1.5, farmId: farm.id },
    { id: POND_IDS.B1, name: 'Ao nuôi B1', areaSize: 2000, depth: 1.5, farmId: farm.id },
    { id: POND_IDS.B2, name: 'Ao nuôi B2', areaSize: 2000, depth: 1.5, farmId: farm.id },
    { id: POND_IDS.B3, name: 'Ao nuôi B3', areaSize: 2000, depth: 1.5, farmId: farm.id },
  ];

  for (const p of pondsData) {
    await prisma.pond.upsert({
      where: { id: p.id },
      update: p,
      create: p,
    });
  }
  console.log(`  ✔ Đã thiết lập 6 ao nuôi: Ao A1, A2, A3 (Khu A) và Ao B1, B2, B3 (Khu B).`);

  // ---------------------------------------------------------------------------
  // BƯỚC 4: NHÀ CUNG CẤP & 22 SẢN PHẨM TRONG KHO (SUPPLIER & INVENTORIES)
  // ---------------------------------------------------------------------------
  console.log('\n[4/12] 📦 Thiết lập Nhà cung cấp & Khởi tạo 22 mặt hàng kho...');

  await prisma.supplier.upsert({
    where: { id: SUPPLIER_ID },
    update: {
      name: 'Công ty TNHH Thủy Sản Quốc Tế GrowMax - Bayer',
      phone: '02838999999',
      email: 'contact@growmax-bayer.vn',
      address: 'KCN Hiệp Phước, Nhà Bè, TP. Hồ Chí Minh',
      farmId: farm.id,
      note: 'Nhà cung cấp thức ăn chất lượng cao, vôi khoáng và chế phẩm sinh học tiêu chuẩn 5T.',
    },
    create: {
      id: SUPPLIER_ID,
      name: 'Công ty TNHH Thủy Sản Quốc Tế GrowMax - Bayer',
      phone: '02838999999',
      email: 'contact@growmax-bayer.vn',
      address: 'KCN Hiệp Phước, Nhà Bè, TP. Hồ Chí Minh',
      farmId: farm.id,
      note: 'Nhà cung cấp thức ăn chất lượng cao, vôi khoáng và chế phẩm sinh học tiêu chuẩn 5T.',
    },
  });

  const inventoryDefinitions = [
    // A. THỨC ĂN (FEED)
    { id: 'inv-feed-001', itemName: 'Cám số 0 (Bột mịn ương PL10-PL15)', category: 'FEED', unit: 'kg', packageType: 'Bao 20kg', weightPerPkg: 20, pricePerPackage: 1100000, minThreshold: 50, description: 'Cám hạt mịn cao cấp đạm 42% dùng cho tôm ương' },
    { id: 'inv-feed-002', itemName: 'Cám số 1 (Viên mảnh 0.8-1.0mm)', category: 'FEED', unit: 'kg', packageType: 'Bao 25kg', weightPerPkg: 25, pricePerPackage: 1125000, minThreshold: 100, description: 'Cám viên mảnh đạm 40% cho tôm ngày 10-25' },
    { id: 'inv-feed-003', itemName: 'Cám số 2 (Viên tròn 1.2-1.4mm)', category: 'FEED', unit: 'kg', packageType: 'Bao 25kg', weightPerPkg: 25, pricePerPackage: 1000000, minThreshold: 200, description: 'Cám viên đạm 38% cho tôm ngày 25-50' },
    { id: 'inv-feed-004', itemName: 'Cám số 3 (Viên tròn 1.6-1.8mm)', category: 'FEED', unit: 'kg', packageType: 'Bao 25kg', weightPerPkg: 25, pricePerPackage: 950000, minThreshold: 300, description: 'Cám viên đạm 38% cho tôm ngày 50-75' },
    { id: 'inv-feed-005', itemName: 'Cám số 4 (Viên tròn 2.0-2.2mm)', category: 'FEED', unit: 'kg', packageType: 'Bao 25kg', weightPerPkg: 25, pricePerPackage: 900000, minThreshold: 300, description: 'Cám viên đạm 36% giai đoạn về đích ngày 75-90' },

    // B. HÓA CHẤT & XỬ LÝ NƯỚC (CHEMICAL)
    { id: 'inv-chem-001', itemName: 'Vôi nông nghiệp Dolomite Super (Tăng kiềm, ổn định pH)', category: 'CHEMICAL', unit: 'kg', packageType: 'Bao 25kg', weightPerPkg: 25, pricePerPackage: 150000, minThreshold: 200, description: 'Vôi giàu Magiê và Canxi tăng kiềm an toàn' },
    { id: 'inv-chem-002', itemName: 'Vôi Canxi Nóng CaCO3 (Hạ phèn, tăng nhanh pH sau mưa)', category: 'CHEMICAL', unit: 'kg', packageType: 'Bao 25kg', weightPerPkg: 25, pricePerPackage: 175000, minThreshold: 200, description: 'Vôi tinh khiết tăng pH cấp tốc khi trời mưa' },
    { id: 'inv-chem-003', itemName: 'Khoáng tạt Premix Đa Vi Lượng Max-Mineral', category: 'CHEMICAL', unit: 'kg', packageType: 'Gói 10kg', weightPerPkg: 10, pricePerPackage: 450000, minThreshold: 100, description: 'Khoáng nano tổng hợp chống cong thân, đục cơ, mềm vỏ' },
    { id: 'inv-chem-004', itemName: 'Men vi sinh đáy ao Bacillus Subtilis Đậm Đặc', category: 'CHEMICAL', unit: 'kg', packageType: 'Gói 500g', weightPerPkg: 0.5, pricePerPackage: 125000, minThreshold: 20, description: 'Chủng Bacillus phân hủy nhớt bạt, xác tảo và bùn đáy' },
    { id: 'inv-chem-005', itemName: 'Chế phẩm sinh học Yucca Schidigera Hấp thụ khí độc', category: 'CHEMICAL', unit: 'lít', packageType: 'Can 5L', weightPerPkg: 5, pricePerPackage: 750000, minThreshold: 20, description: 'Chiết xuất cây ngọc giá khử cấp tốc NH3 và NO2 đáy ao' },
    { id: 'inv-chem-006', itemName: 'Oxy viên cấp cứu Nano-O2', category: 'CHEMICAL', unit: 'kg', packageType: 'Can 5kg', weightPerPkg: 5, pricePerPackage: 450000, minThreshold: 30, description: 'Viên sủi giải phóng oxy tinh khiết tầng đáy ao ban đêm' },
    { id: 'inv-chem-007', itemName: 'Khoáng Zeolite Hạt Hấp phụ kim loại & khí độc', category: 'CHEMICAL', unit: 'kg', packageType: 'Bao 20kg', weightPerPkg: 20, pricePerPackage: 300000, minThreshold: 100, description: 'Khoáng tự nhiên lắng tụ chất lơ lửng và kim loại' },
    { id: 'inv-chem-008', itemName: 'Chất khử phèn & kim loại nặng EDTA Super', category: 'CHEMICAL', unit: 'kg', packageType: 'Bao 10kg', weightPerPkg: 10, pricePerPackage: 750000, minThreshold: 30, description: 'Cô lập độc tố kim loại nặng và phèn khi sập tảo' },
    { id: 'inv-chem-009', itemName: 'Mật rỉ đường lên men vi sinh EM1', category: 'CHEMICAL', unit: 'lít', packageType: 'Can 30L', weightPerPkg: 30, pricePerPackage: 300000, minThreshold: 60, description: 'Nguồn Carbon sinh học ủ men vi sinh và cân bằng C:N' },
    { id: 'inv-chem-010', itemName: 'Thuốc tím KMnO4 Kỹ Thuật (Sát trùng nguồn nước)', category: 'CHEMICAL', unit: 'kg', packageType: 'Thùng 25kg', weightPerPkg: 25, pricePerPackage: 2000000, minThreshold: 25, description: 'Chất oxy hóa mạnh diệt tảo độc và sát khuẩn' },
    { id: 'inv-chem-011', itemName: 'Chế phẩm diệt khuẩn an toàn BKC 80%', category: 'CHEMICAL', unit: 'lít', packageType: 'Can 5L', weightPerPkg: 5, pricePerPackage: 650000, minThreshold: 20, description: 'Diệt khuẩn Vibrio nước và tẩy sạch rong nhớt bám' },

    // C. THUỐC & BẢO VỆ SỨC KHỎE TÔM (MEDICINE)
    { id: 'inv-med-001', itemName: 'Thảo dược bổ gan tụy Hepasol Extra', category: 'MEDICINE', unit: 'lít', packageType: 'Chai 1L', weightPerPkg: 1, pricePerPackage: 420000, minThreshold: 20, description: 'Cao thảo dược giải độc gan, phòng teo gan tụy cấp AHPND' },
    { id: 'inv-med-002', itemName: 'Men vi sinh đường ruột Probiotic Lactobacillus', category: 'MEDICINE', unit: 'kg', packageType: 'Gói 500g', weightPerPkg: 0.5, pricePerPackage: 90000, minThreshold: 20, description: 'Men tiêu hóa đường ruột, ức chế vi khuẩn có hại' },
    { id: 'inv-med-003', itemName: 'Vitamin C tạt & trộn ăn chống sốc Anti-Stress 50%', category: 'MEDICINE', unit: 'kg', packageType: 'Gói 5kg', weightPerPkg: 5, pricePerPackage: 350000, minThreshold: 30, description: 'Tăng đề kháng, chống sốc nhiệt khi thời tiết giao mùa' },
    { id: 'inv-med-004', itemName: 'Thảo dược đặc trị phân trắng Bactogut', category: 'MEDICINE', unit: 'lít', packageType: 'Chai 1L', weightPerPkg: 1, pricePerPackage: 480000, minThreshold: 15, description: 'Đặc trị đứt khúc ruột, phân lỏng, phân trắng WFD' },
    { id: 'inv-med-005', itemName: 'Cao tỏi đen lên men Allicin Kháng khuẩn tự nhiên', category: 'MEDICINE', unit: 'lít', packageType: 'Can 2L', weightPerPkg: 2, pricePerPackage: 380000, minThreshold: 15, description: 'Kháng sinh sinh học tự nhiên phòng trị bệnh đường ruột' },
    { id: 'inv-med-006', itemName: 'Beta-Glucan & Tăng cường miễn dịch Gluca-Shield', category: 'MEDICINE', unit: 'kg', packageType: 'Gói 1kg', weightPerPkg: 1, pricePerPackage: 520000, minThreshold: 15, description: 'Kích hoạt hệ miễn dịch dịch thể, ngăn ngừa dịch bệnh' },
  ];

  for (const item of inventoryDefinitions) {
    await prisma.inventory.upsert({
      where: { id: item.id },
      update: {
        itemName: item.itemName,
        category: item.category,
        unit: item.unit,
        packageType: item.packageType,
        weightPerPkg: item.weightPerPkg,
        pricePerPackage: item.pricePerPackage,
        minThreshold: item.minThreshold,
        description: item.description,
        farmId: farm.id,
        supplierId: SUPPLIER_ID,
      },
      create: {
        id: item.id,
        itemName: item.itemName,
        category: item.category,
        unit: item.unit,
        packageType: item.packageType,
        weightPerPkg: item.weightPerPkg,
        pricePerPackage: item.pricePerPackage,
        minThreshold: item.minThreshold,
        description: item.description,
        farmId: farm.id,
        supplierId: SUPPLIER_ID,
      },
    });
  }
  console.log(`  ✔ Đã khởi tạo 22 mặt hàng kho (5 loại cám, 11 hóa chất môi trường, 6 chế phẩm thuốc).`);

  // ---------------------------------------------------------------------------
  // BƯỚC 5: DỌN DẸP DỮ LIỆU CŨ & THIẾT LẬP 13 VỤ NUÔI LIÊN TỤC
  // ---------------------------------------------------------------------------
  console.log('\n[5/12] 🧹 Làm sạch dữ liệu vận hành cũ trước khi thiết lập vụ nuôi...');
  await prisma.notification.deleteMany({});
  await prisma.knowledgeChunk.deleteMany({});
  await prisma.knowledgeDocument.deleteMany({});
  await prisma.mortalityLog.deleteMany({});
  await prisma.incidentTreatmentUpdate.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.shrimpHealthRecord.deleteMany({});
  await prisma.shrimpSizeSample.deleteMany({});
  await prisma.waterQualityRecord.deleteMany({});
  await prisma.feedingLog.deleteMany({});
  await prisma.inventoryUsageLog.deleteMany({});
  await prisma.environmentRecord.deleteMany({});
  // Xóa crop con trước, sau đó xóa crop cha
  await prisma.crop.deleteMany({ where: { parentCropId: { not: null } } });
  await prisma.crop.deleteMany({});
  console.log('  ✔ Đã dọn dẹp sạch sẽ dữ liệu cũ.');

  console.log('\n[5/12] 🦐 Thiết lập cấu trúc 13 vụ nuôi liên tục (4 vụ nuôi chuẩn + 1 vụ ương B1)...');

  // Mảng định nghĩa 13 vụ:
  // - Khi tách ao, ao ương gốc (Ao A1 / Ao B1) tiếp tục nuôi thương phẩm trong CÙNG 1 VỤ ĐÓ (không tạo ra vụ nursery kết thúc riêng lẻ).
  // - Ao A2, Ao A3 (hoặc B2, B3) là các vụ con liên kết với parentCropId là ao gốc.
  // - Vụ 4: Ao A1 (89 ngày nuôi - DOC 90), Ao A2 & Ao A3 (69 ngày nuôi - DOC 70) đều ACTIVE -> Sẵn sàng thu hoạch.
  // - Ao B1: Vụ ương mới thả 24/09/2026, đúng 20 ngày nuôi -> Sẵn sàng bấm "Tách ao".
  const cropsSetup = [
    // === VỤ 1: VỤ ĐÔNG CUỐI NĂM 2025 (Ao A1 -> A1, A2, A3) — SIÊU LỢI NHUẬN (+732M) ===
    // 1. Ao A1: Vụ ương + nuôi thương phẩm liên tục (90 ngày)
    {
      id: 'c1000000-0000-4000-8000-000000000001',
      pondId: POND_IDS.A1,
      startDate: parseDate('2025-09-15'),
      initialShrimpCount: 300000,
      stage: 'COMMERCIAL',
      status: 'HARVESTED',
      parentCropId: null,
      transferDate: parseDate('2025-10-05'),
      actualNurseryHarvest: 288000,
      nurserySurvivalRate: 96.0,
      transferSize: 277.8,
      splitNote: 'Ương 20 ngày thành công rực rỡ, tôm khỏe, đồng đều, đạt 96% tỷ lệ sống. Giữ lại 100.000 con tại Ao A1, chuyển 95.000 con sang Ao A2 và 93.000 con sang Ao A3.',
      actualHarvestDate: parseDate('2025-12-14'),
      actualHarvestCount: 87000,
      actualHarvestKg: 4350,
      actualHarvestSize: 20.0,
      actualHarvestPricePerKg: 165000,
      actualHarvestRevenue: 717750000,
      actualHarvestCost: 422000000,
      actualHarvestProfit: 295750000,
      actualHarvestFcr: 1.16,
      actualHarvestSurvivalRate: 87.0,
      harvestFeedCost: 213000000,
      harvestMedicineCost: 44000000,
      harvestChemicalCost: 40000000,
      harvestSeedCost: 15000000,
      harvestElectricityCost: 72000000,
      harvestLaborCost: 48000000,
      harvestOtherCost: 26000000,
      harvestFeedKg: 5046,
      harvestEvaluation: 'Tôm đạt size siêu đại 20 con/kg, chất lượng vỏ bóng đẹp, không hao hụt.',
      harvestLessonsLearned: 'Duy trì độ kiềm 140 mg/L và vi sinh định kỳ giúp tôm lột vỏ đồng loạt.',
      expectedDurationDays: 90,
    },
    // 2. Ao A2: Nuôi thương phẩm sau tách ao (70 ngày)
    {
      id: 'c1000000-0000-4000-8000-000000000002',
      pondId: POND_IDS.A2,
      startDate: parseDate('2025-10-05'),
      initialShrimpCount: 95000,
      stage: 'COMMERCIAL',
      status: 'HARVESTED',
      parentCropId: 'c1000000-0000-4000-8000-000000000001',
      actualHarvestDate: parseDate('2025-12-14'),
      actualHarvestCount: 82800,
      actualHarvestKg: 3600,
      actualHarvestSize: 23.0,
      actualHarvestPricePerKg: 165000,
      actualHarvestRevenue: 594000000,
      actualHarvestCost: 350000000,
      actualHarvestProfit: 244000000,
      actualHarvestFcr: 1.19,
      actualHarvestSurvivalRate: 87.2,
      harvestFeedCost: 177000000,
      harvestMedicineCost: 37000000,
      harvestChemicalCost: 33000000,
      harvestSeedCost: 15000000,
      harvestElectricityCost: 60000000,
      harvestLaborCost: 40000000,
      harvestOtherCost: 22000000,
      harvestFeedKg: 4284,
      harvestEvaluation: 'Sản lượng đạt 3.6 tấn, màu tôm sáng đẹp, thương lái thu mua giá cao.',
      expectedDurationDays: 70,
    },
    // 3. Ao A3: Nuôi thương phẩm sau tách ao (70 ngày)
    {
      id: 'c1000000-0000-4000-8000-000000000003',
      pondId: POND_IDS.A3,
      startDate: parseDate('2025-10-05'),
      initialShrimpCount: 93000,
      stage: 'COMMERCIAL',
      status: 'HARVESTED',
      parentCropId: 'c1000000-0000-4000-8000-000000000001',
      actualHarvestDate: parseDate('2025-12-14'),
      actualHarvestCount: 80760,
      actualHarvestKg: 2850,
      actualHarvestSize: 28.3,
      actualHarvestPricePerKg: 165000,
      actualHarvestRevenue: 470250000,
      actualHarvestCost: 278000000,
      actualHarvestProfit: 192250000,
      actualHarvestFcr: 1.20,
      actualHarvestSurvivalRate: 86.8,
      harvestFeedCost: 140000000,
      harvestMedicineCost: 29000000,
      harvestChemicalCost: 27000000,
      harvestSeedCost: 15000000,
      harvestElectricityCost: 48000000,
      harvestLaborCost: 32000000,
      harvestOtherCost: 17000000,
      harvestFeedKg: 3420,
      harvestEvaluation: 'Tổng kết Vụ 1 toàn trang trại thu lãi ròng kỷ lục 732 triệu đồng.',
      expectedDurationDays: 70,
    },

    // === VỤ 2: VỤ XUÂN HÈ ĐẦU NĂM 2026 (Ao A1 -> A1, A2, A3) — LỖ NẶNG (-255.5M, CẮT LỖ) ===
    // 4. Ao A1: Vụ ương + nuôi thương phẩm liên tục (75 ngày)
    {
      id: 'c2000000-0000-4000-8000-000000000001',
      pondId: POND_IDS.A1,
      startDate: parseDate('2026-03-01'),
      initialShrimpCount: 300000,
      stage: 'COMMERCIAL',
      status: 'HARVESTED',
      parentCropId: null,
      transferDate: parseDate('2026-03-21'),
      actualNurseryHarvest: 270000,
      nurserySurvivalRate: 90.0,
      transferSize: 312.5,
      splitNote: 'Ương gặp đợt nắng gắt đầu mùa, tôm sốc nhiệt hao hụt 10%. Giữ lại 90.000 con tại Ao A1, chuyển 90.000 con sang Ao A2 và 90.000 con sang Ao A3.',
      actualHarvestDate: parseDate('2026-05-15'),
      actualHarvestCount: 47700,
      actualHarvestKg: 920,
      actualHarvestSize: 51.8,
      actualHarvestPricePerKg: 85000,
      actualHarvestRevenue: 78200000,
      actualHarvestCost: 165000000,
      actualHarvestProfit: -86800000,
      actualHarvestFcr: 1.80,
      actualHarvestSurvivalRate: 53.0,
      harvestFeedCost: 71000000,
      harvestMedicineCost: 43000000,
      harvestChemicalCost: 18000000,
      harvestSeedCost: 15000000,
      harvestElectricityCost: 22000000,
      harvestLaborCost: 14000000,
      harvestOtherCost: 8000000,
      harvestFeedKg: 1656,
      harvestEvaluation: 'Dịch phân trắng và hoại tử gan tụy bùng phát sau mưa giông sập tảo.',
      harvestLessonsLearned: 'Cần kiểm soát chặt lượng thức ăn và tạt vi sinh định kỳ ngay khi thời tiết đổi mùa.',
      expectedDurationDays: 75,
    },
    // 5. Ao A2: Nuôi thương phẩm sau tách ao (55 ngày)
    {
      id: 'c2000000-0000-4000-8000-000000000002',
      pondId: POND_IDS.A2,
      startDate: parseDate('2026-03-21'),
      initialShrimpCount: 90000,
      stage: 'COMMERCIAL',
      status: 'HARVESTED',
      parentCropId: 'c2000000-0000-4000-8000-000000000001',
      actualHarvestDate: parseDate('2026-05-15'),
      actualHarvestCount: 46500,
      actualHarvestKg: 900,
      actualHarvestSize: 51.8,
      actualHarvestPricePerKg: 85000,
      actualHarvestRevenue: 76500000,
      actualHarvestCost: 162000000,
      actualHarvestProfit: -85500000,
      actualHarvestFcr: 1.83,
      actualHarvestSurvivalRate: 51.7,
      harvestFeedCost: 70000000,
      harvestMedicineCost: 42000000,
      harvestChemicalCost: 18000000,
      harvestSeedCost: 15000000,
      harvestElectricityCost: 22000000,
      harvestLaborCost: 13000000,
      harvestOtherCost: 8000000,
      harvestFeedKg: 1647,
      harvestEvaluation: 'Tôm còi cọc, chậm lớn, tốn kém chi phí thuốc thảo dược điều trị dịch bệnh.',
      expectedDurationDays: 55,
    },
    // 6. Ao A3: Nuôi thương phẩm sau tách ao (55 ngày)
    {
      id: 'c2000000-0000-4000-8000-000000000003',
      pondId: POND_IDS.A3,
      startDate: parseDate('2026-03-21'),
      initialShrimpCount: 90000,
      stage: 'COMMERCIAL',
      status: 'HARVESTED',
      parentCropId: 'c2000000-0000-4000-8000-000000000001',
      actualHarvestDate: parseDate('2026-05-15'),
      actualHarvestCount: 45800,
      actualHarvestKg: 880,
      actualHarvestSize: 52.0,
      actualHarvestPricePerKg: 85000,
      actualHarvestRevenue: 74800000,
      actualHarvestCost: 158000000,
      actualHarvestProfit: -83200000,
      actualHarvestFcr: 1.83,
      actualHarvestSurvivalRate: 50.8,
      harvestFeedCost: 69000000,
      harvestMedicineCost: 40000000,
      harvestChemicalCost: 18000000,
      harvestSeedCost: 15000000,
      harvestElectricityCost: 21000000,
      harvestLaborCost: 13000000,
      harvestOtherCost: 7000000,
      harvestFeedKg: 1610,
      harvestEvaluation: 'Quản lý quyết định thu hoạch sớm ở DOC 75 để cắt lỗ, tránh rủi ro tôm chết hàng loạt.',
      expectedDurationDays: 55,
    },

    // === VỤ 3: VỤ HÈ THU 2026 (Ao B1 -> B1, B2, B3) — LỜI ÍT (+75M) ===
    // 7. Ao B1: Vụ ương + nuôi thương phẩm liên tục (86 ngày)
    {
      id: 'c3000000-0000-4000-8000-000000000001',
      pondId: POND_IDS.B1,
      startDate: parseDate('2026-04-15'),
      initialShrimpCount: 300000,
      stage: 'COMMERCIAL',
      status: 'HARVESTED',
      parentCropId: null,
      transferDate: parseDate('2026-05-05'),
      actualNurseryHarvest: 280000,
      nurserySurvivalRate: 93.3,
      transferSize: 285.7,
      splitNote: 'Ương tôm ổn định, tôm thích nghi tốt với độ mặn mùa hè. Giữ lại 95.000 con tại Ao B1, chuyển 95.000 con sang Ao B2 và 90.000 con sang Ao B3.',
      actualHarvestDate: parseDate('2026-07-10'),
      actualHarvestCount: 69160,
      actualHarvestKg: 2050,
      actualHarvestSize: 33.7,
      actualHarvestPricePerKg: 115000,
      actualHarvestRevenue: 235750000,
      actualHarvestCost: 210000000,
      actualHarvestProfit: 25750000,
      actualHarvestFcr: 1.37,
      actualHarvestSurvivalRate: 72.8,
      harvestFeedCost: 116000000,
      harvestMedicineCost: 26000000,
      harvestChemicalCost: 25000000,
      harvestSeedCost: 15000000,
      harvestElectricityCost: 32000000,
      harvestLaborCost: 20000000,
      harvestOtherCost: 11000000,
      harvestFeedKg: 2808,
      harvestEvaluation: 'Mùa mưa hè làm tôm tăng trưởng trung bình, kiểm soát môi trường tốt giúp có lãi.',
      expectedDurationDays: 86,
    },
    // 8. Ao B2: Nuôi thương phẩm sau tách ao (66 ngày)
    {
      id: 'c3000000-0000-4000-8000-000000000002',
      pondId: POND_IDS.B2,
      startDate: parseDate('2026-05-05'),
      initialShrimpCount: 95000,
      stage: 'COMMERCIAL',
      status: 'HARVESTED',
      parentCropId: 'c3000000-0000-4000-8000-000000000001',
      actualHarvestDate: parseDate('2026-07-10'),
      actualHarvestCount: 67450,
      actualHarvestKg: 2000,
      actualHarvestSize: 33.7,
      actualHarvestPricePerKg: 115000,
      actualHarvestRevenue: 230000000,
      actualHarvestCost: 205000000,
      actualHarvestProfit: 25000000,
      actualHarvestFcr: 1.38,
      actualHarvestSurvivalRate: 71.0,
      harvestFeedCost: 114000000,
      harvestMedicineCost: 25000000,
      harvestChemicalCost: 25000000,
      harvestSeedCost: 15000000,
      harvestElectricityCost: 32000000,
      harvestLaborCost: 20000000,
      harvestOtherCost: 10000000,
      harvestFeedKg: 2760,
      harvestEvaluation: 'Tôm đạt size thương phẩm 33 con/kg, giá bán ổn định.',
      expectedDurationDays: 66,
    },
    // 9. Ao B3: Nuôi thương phẩm sau tách ao (66 ngày)
    {
      id: 'c3000000-0000-4000-8000-000000000003',
      pondId: POND_IDS.B3,
      startDate: parseDate('2026-05-05'),
      initialShrimpCount: 90000,
      stage: 'COMMERCIAL',
      status: 'HARVESTED',
      parentCropId: 'c3000000-0000-4000-8000-000000000001',
      actualHarvestDate: parseDate('2026-07-10'),
      actualHarvestCount: 65400,
      actualHarvestKg: 1950,
      actualHarvestSize: 33.5,
      actualHarvestPricePerKg: 115000,
      actualHarvestRevenue: 224250000,
      actualHarvestCost: 200000000,
      actualHarvestProfit: 24250000,
      actualHarvestFcr: 1.39,
      actualHarvestSurvivalRate: 72.6,
      harvestFeedCost: 110000000,
      harvestMedicineCost: 24000000,
      harvestChemicalCost: 25000000,
      harvestSeedCost: 15000000,
      harvestElectricityCost: 31000000,
      harvestLaborCost: 20000000,
      harvestOtherCost: 9000000,
      harvestFeedKg: 2710,
      harvestEvaluation: 'Tổng kết Vụ 3 đạt mục tiêu hồi vốn và có lãi nhẹ 75 triệu đồng.',
      expectedDurationDays: 66,
    },

    // === VỤ 4: VỤ HIỆN TẠI (Ao A1 -> A1, A2, A3) — ĐANG ACTIVE NGÀY 90 (HÔM NAY 14/10/2026) ===
    // 10. Ao A1: Vụ ương + nuôi thương phẩm liên tục (89 ngày nuôi - DOC 90, SẴN SÀNG THU HOẠCH)
    {
      id: 'c0000000-0000-4000-8000-000000000001',
      pondId: POND_IDS.A1,
      startDate: parseDate('2026-07-17'),
      initialShrimpCount: 300000,
      stage: 'COMMERCIAL',
      status: 'ACTIVE',
      parentCropId: null,
      transferDate: parseDate('2026-08-06'),
      actualNurseryHarvest: 285000,
      nurserySurvivalRate: 95.0,
      transferSize: 277.8,
      splitNote: 'Ương tôm khỏe mạnh, tỷ lệ sống 95%, giữ lại 100.000 con tại Ao A1, chuyển 95.000 con sang Ao A2 và 90.000 con sang Ao A3.',
      targetHarvestSize: 20.0,
      targetSurvivalRate: 80.0,
      expectedDurationDays: 90,
      expectedHarvestDate: parseDate('2026-10-14'),
    },
    // 11. Ao A2: Nuôi thương phẩm sau tách ao (69 ngày nuôi - DOC 70, SẴN SÀNG THU HOẠCH)
    {
      id: 'c0000000-0000-4000-8000-000000000002',
      pondId: POND_IDS.A2,
      startDate: parseDate('2026-08-06'),
      initialShrimpCount: 95000,
      stage: 'COMMERCIAL',
      status: 'ACTIVE',
      parentCropId: 'c0000000-0000-4000-8000-000000000001',
      targetHarvestSize: 22.0,
      targetSurvivalRate: 80.0,
      expectedDurationDays: 70,
      expectedHarvestDate: parseDate('2026-10-14'),
    },
    // 12. Ao A3: Nuôi thương phẩm sau tách ao (69 ngày nuôi - DOC 70, SẴN SÀNG THU HOẠCH)
    {
      id: 'c0000000-0000-4000-8000-000000000003',
      pondId: POND_IDS.A3,
      startDate: parseDate('2026-08-06'),
      initialShrimpCount: 90000,
      stage: 'COMMERCIAL',
      status: 'ACTIVE',
      parentCropId: 'c0000000-0000-4000-8000-000000000001',
      targetHarvestSize: 25.0,
      targetSurvivalRate: 80.0,
      expectedDurationDays: 70,
      expectedHarvestDate: parseDate('2026-10-14'),
    },

    // === VỤ ƯƠNG MỚI TẠI AO B1: NUÔI ĐƯỢC ĐÚNG 20 NGÀY ĐỂ BẤM TÁCH AO ===
    // 13. Ao B1: Ương tôm giống 20 ngày (thả 24/09/2026 -> 14/10/2026, SẴN SÀNG TÁCH AO)
    {
      id: 'c0000000-0000-4000-8000-000000000010',
      pondId: POND_IDS.B1,
      startDate: parseDate('2026-09-24'),
      initialShrimpCount: 300000,
      stage: 'NURSERY',
      status: 'ACTIVE',
      parentCropId: null,
      targetHarvestSize: 300.0,
      targetSurvivalRate: 95.0,
      expectedDurationDays: 20,
      expectedTransferDate: parseDate('2026-10-14'),
    },
  ];

  // Tạo các vụ nuôi gốc trước (không có parentCropId), sau đó tạo các vụ con
  for (const c of cropsSetup.filter((c) => !c.parentCropId)) {
    await prisma.crop.upsert({ where: { id: c.id }, update: c, create: c });
  }
  for (const c of cropsSetup.filter((c) => c.parentCropId)) {
    await prisma.crop.upsert({ where: { id: c.id }, update: c, create: c });
  }
  console.log(`  ✔ Đã thiết lập 13 vụ nuôi hoàn chỉnh (12 ao thương phẩm/gốc + 1 ao ương mới tại Ao B1).`);

  // ---------------------------------------------------------------------------
  // BƯỚC 6: NHẬP KHO ĐẦU CÁC VỤ NUÔI (INVENTORY USAGE LOGS - IMPORT)
  // ---------------------------------------------------------------------------
  console.log('\n[6/12] 📥 Ghi nhận các phiếu Nhập kho đầu vụ với số lượng dồi dào...');

  const importLogs = [];
  const inventoryUsageTracker = {}; // item_id -> totalUsed
  inventoryDefinitions.forEach((i) => (inventoryUsageTracker[i.id] = 0));

  const addImport = (invId, qty, dateStr, note) => {
    importLogs.push({
      inventoryId: invId,
      quantityUsed: qty,
      usageDate: parseDate(dateStr),
      notes: `[NHẬP KHO: +${qty} ${inventoryDefinitions.find((i) => i.id === invId).unit}] — ${note}`,
      createdBy: manager.id,
    });
  };

  // Đợt 1: Nhập kho chuẩn bị Vụ 1 (Tháng 9/2025)
  addImport('inv-feed-001', 1500, '2025-09-10', 'Nhập cám số 0 bột mịn cho ao ương Vụ 1');
  addImport('inv-feed-002', 6000, '2025-09-10', 'Nhập cám số 1 cho giai đoạn đầu Vụ 1');
  addImport('inv-feed-003', 10000, '2025-10-01', 'Nhập cám số 2 sau tách ao Vụ 1');
  addImport('inv-feed-004', 12000, '2025-10-25', 'Nhập cám số 3 giai đoạn lớn Vụ 1');
  addImport('inv-feed-005', 13000, '2025-11-15', 'Nhập cám số 4 giai đoạn về đích Vụ 1');
  addImport('inv-chem-001', 3000, '2025-09-10', 'Nhập vôi Dolomite Super chuẩn bị nước Vụ 1');
  addImport('inv-chem-002', 2000, '2025-09-10', 'Nhập vôi Canxi CaCO3 ổn định pH Vụ 1');
  addImport('inv-chem-003', 800, '2025-09-10', 'Nhập khoáng Premix Max-Mineral Vụ 1');
  addImport('inv-chem-004', 100, '2025-09-10', 'Nhập men vi sinh đáy Bacillus Vụ 1');
  addImport('inv-chem-005', 120, '2025-09-10', 'Nhập chế phẩm Yucca khử khí độc Vụ 1');
  addImport('inv-chem-006', 150, '2025-09-10', 'Nhập oxy viên Nano-O2 cấp cứu Vụ 1');
  addImport('inv-chem-007', 800, '2025-09-10', 'Nhập Zeolite hạt lắng tụ nước Vụ 1');
  addImport('inv-chem-008', 200, '2025-09-10', 'Nhập chất khử phèn EDTA Vụ 1');
  addImport('inv-chem-009', 500, '2025-09-10', 'Nhập mật rỉ đường EM1 Vụ 1');
  addImport('inv-chem-010', 100, '2025-09-10', 'Nhập thuốc tím KMnO4 Vụ 1');
  addImport('inv-chem-011', 120, '2025-09-10', 'Nhập thuốc sát trùng diệt khuẩn BKC 80% Vụ 1');
  addImport('inv-med-001', 80, '2025-09-10', 'Nhập thảo dược bổ gan Hepasol Vụ 1');
  addImport('inv-med-002', 60, '2025-09-10', 'Nhập men vi sinh tiêu hóa Probiotic Vụ 1');
  addImport('inv-med-003', 150, '2025-09-10', 'Nhập Vitamin C chống sốc Vụ 1');
  addImport('inv-med-004', 50, '2025-09-10', 'Nhập thảo dược trị phân trắng Bactogut Vụ 1');
  addImport('inv-med-005', 80, '2025-09-10', 'Nhập cao tỏi đen Allicin Vụ 1');
  addImport('inv-med-006', 80, '2025-09-10', 'Nhập Beta-Glucan tăng miễn dịch Vụ 1');

  // Đợt 2: Nhập bổ sung cho Vụ 2 & Vụ 3 (Đầu năm 2026)
  addImport('inv-feed-001', 1500, '2026-02-25', 'Nhập cám ương số 0 cho vụ đầu năm 2026');
  addImport('inv-feed-002', 6000, '2026-02-25', 'Nhập cám số 1 cho Vụ 2 & 3');
  addImport('inv-feed-003', 10000, '2026-03-15', 'Nhập cám số 2 cho Vụ 2 & 3');
  addImport('inv-feed-004', 13000, '2026-04-10', 'Nhập cám số 3 cho Vụ 2 & 3');
  addImport('inv-feed-005', 13000, '2026-05-15', 'Nhập cám số 4 cho Vụ 3');
  addImport('inv-chem-001', 4000, '2026-02-25', 'Nhập vôi Dolomite đợt mùa khô 2026');
  addImport('inv-chem-002', 3000, '2026-02-25', 'Nhập vôi Canxi CaCO3 đợt mùa khô 2026');
  addImport('inv-chem-003', 1000, '2026-02-25', 'Nhập khoáng Premix Max-Mineral đợt 2026');
  addImport('inv-chem-004', 150, '2026-02-25', 'Nhập men vi sinh đáy Bacillus đợt 2026');
  addImport('inv-chem-005', 200, '2026-02-25', 'Nhập Yucca Schidigera xử lý khí độc mùa nóng');
  addImport('inv-chem-006', 200, '2026-02-25', 'Nhập oxy viên Nano-O2 dự phòng mùa nóng');
  addImport('inv-chem-008', 300, '2026-02-25', 'Nhập EDTA xử lý sập tảo đầu vụ');
  addImport('inv-med-001', 120, '2026-02-25', 'Nhập lượng lớn thảo dược gan Hepasol phòng dịch');
  addImport('inv-med-002', 100, '2026-02-25', 'Nhập men tiêu hóa Probiotic hỗ trợ ruột');
  addImport('inv-med-004', 100, '2026-03-25', 'Nhập thảo dược đặc trị phân trắng Bactogut');
  addImport('inv-med-005', 100, '2026-03-25', 'Nhập cao tỏi đen Allicin tăng sức đề kháng');

  // Đợt 3: Nhập kho chuẩn bị Vụ 4 (Tháng 7/2026)
  addImport('inv-feed-001', 1500, '2026-07-12', 'Nhập cám số 0 phục vụ ương tôm Vụ 4');
  addImport('inv-feed-002', 6500, '2026-07-12', 'Nhập cám số 1 phục vụ Vụ 4');
  addImport('inv-feed-003', 10000, '2026-08-01', 'Nhập cám số 2 sau tách ao Vụ 4');
  addImport('inv-feed-004', 13000, '2026-08-25', 'Nhập cám số 3 giai đoạn lớn Vụ 4');
  addImport('inv-feed-005', 14000, '2026-09-15', 'Nhập cám số 4 giai đoạn về đích Vụ 4');
  addImport('inv-chem-001', 3500, '2026-07-12', 'Nhập vôi Dolomite Super Vụ 4 mùa mưa');
  addImport('inv-chem-002', 2500, '2026-07-12', 'Nhập vôi Canxi CaCO3 Vụ 4 mùa mưa');
  addImport('inv-chem-003', 1200, '2026-07-12', 'Nhập khoáng Premix Max-Mineral Vụ 4');
  addImport('inv-chem-004', 150, '2026-07-12', 'Nhập vi sinh Bacillus đậm đặc Vụ 4');
  addImport('inv-chem-005', 150, '2026-07-12', 'Nhập Yucca Schidigera xử lý khí độc Vụ 4');
  addImport('inv-chem-006', 200, '2026-07-12', 'Nhập oxy viên Nano-O2 mùa giông bão Vụ 4');
  addImport('inv-chem-009', 800, '2026-07-12', 'Nhập mật rỉ đường EM1 Vụ 4');
  addImport('inv-med-001', 100, '2026-07-12', 'Nhập thảo dược gan Hepasol Vụ 4');
  addImport('inv-med-002', 80, '2026-07-12', 'Nhập men vi sinh tiêu hóa Probiotic Vụ 4');
  addImport('inv-med-003', 200, '2026-07-12', 'Nhập Vitamin C chống sốc mùa mưa bão Vụ 4');
  addImport('inv-med-005', 80, '2026-07-12', 'Nhập tỏi đen Allicin Vụ 4');
  addImport('inv-med-006', 80, '2026-07-12', 'Nhập Beta-Glucan tăng miễn dịch Vụ 4');

  // Đợt 4: Nhập kho chuẩn bị Vụ Ương Mới tại Ao B1 (Tháng 9/2026)
  addImport('inv-feed-001', 1000, '2026-09-20', 'Nhập cám số 0 cho ao ương B1 mới');
  addImport('inv-feed-002', 1500, '2026-09-20', 'Nhập cám số 1 cho ao ương B1 mới');
  addImport('inv-chem-001', 500, '2026-09-20', 'Nhập vôi Dolomite ổn định nước ao ương B1');
  addImport('inv-chem-003', 200, '2026-09-20', 'Nhập khoáng Premix ao ương B1');
  addImport('inv-chem-004', 30, '2026-09-20', 'Nhập vi sinh Bacillus ao ương B1');
  addImport('inv-med-002', 20, '2026-09-20', 'Nhập men tiêu hóa Probiotic ao ương B1');
  addImport('inv-med-003', 30, '2026-09-20', 'Nhập Vitamin C ao ương B1');

  await prisma.inventoryUsageLog.createMany({ data: importLogs });
  console.log(`  ✔ Đã ghi nhận ${importLogs.length} phiếu nhập kho đầu các vụ (Người duyệt: ${manager.fullName}).`);

  // ---------------------------------------------------------------------------
  // BƯỚC 7: CHI TIẾT 35 SỰ CỐ MÔI TRƯỜNG & DỊCH BỆNH VÀ XUẤT KHO ĐIỀU TRỊ
  // ---------------------------------------------------------------------------
  console.log('\n[7/12] 🚨 Khởi tạo 35 sự cố môi trường & dịch bệnh kèm chuỗi điều trị và xuất kho...');

  const incidentDefinitions = [
    // === VỤ 1 (8 SỰ CỐ NHẸ, XỬ LÝ TRIỆT ĐỂ, SIÊU LỢI NHUẬN) ===
    {
      cropId: 'c1000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 8,
      title: 'Tảo silic phát triển chậm, nước hơi trong (Độ trong > 45cm)',
      desc: 'Nước ao ương chưa lên màu trà đạt chuẩn, độ trong đo được 48cm.',
      treatment: 'Bón Mật rỉ đường EM1 (10L) + Khoáng Max-Mineral (10kg) gây màu nước trà.',
      supplies: [{ id: 'inv-chem-009', qty: 10 }, { id: 'inv-chem-003', qty: 10 }],
    },
    {
      cropId: 'c1000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 18,
      title: 'Tôm có hiện tượng rải rác mềm vỏ trước khi tách ao',
      desc: 'Khoảng 5% tôm kiểm tra có vỏ hơi mềm trước ngày chia sang các ao thương phẩm.',
      treatment: 'Tạt Khoáng Premix Max-Mineral (15kg) + Canxi CaCO3 (25kg) làm cứng vỏ.',
      supplies: [{ id: 'inv-chem-003', qty: 15 }, { id: 'inv-chem-002', qty: 25 }],
    },
    {
      cropId: 'c1000000-0000-4000-8000-000000000002', pondId: POND_IDS.A2, doc: 28,
      title: 'Biến động độ kiềm sau trận mưa rào cuối thu (Kiềm tụt xuống 105 mg/L)',
      desc: 'Mưa rào kéo dài 2 giờ làm kiềm tụt từ 135 xuống 105 mg/L.',
      treatment: 'Tạt vôi Dolomite Super (50kg) ban đêm để nâng kiềm.',
      supplies: [{ id: 'inv-chem-001', qty: 50 }],
    },
    {
      cropId: 'c1000000-0000-4000-8000-000000000003', pondId: POND_IDS.A3, doc: 36,
      title: 'Bọt nước khó tan ở góc cuối gió, nhớt bạt đáy ao',
      desc: 'Chất thải gom tụ chậm tạo bọt nhớt bạt ở góc dàn quạt.',
      treatment: 'Đánh Men vi sinh đáy Bacillus Subtilis (1kg) ủ mật rỉ đường EM1 (5L).',
      supplies: [{ id: 'inv-chem-004', qty: 1 }, { id: 'inv-chem-009', qty: 5 }],
    },
    {
      cropId: 'c1000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 48,
      title: 'Tôm ăn chậm cữ trưa do trời âm u, đường ruột hơi lỏng',
      desc: 'Thời tiết nhiều mây, tôm ăn thừa 15% thức ăn trên nhá.',
      treatment: 'Giảm 30% cữ cám, trộn Men Probiotic (1kg) + Tỏi đen Allicin (1L).',
      supplies: [{ id: 'inv-med-002', qty: 1 }, { id: 'inv-med-005', qty: 1 }],
    },
    {
      cropId: 'c1000000-0000-4000-8000-000000000002', pondId: POND_IDS.A2, doc: 58,
      title: 'Khí độc NO2 chớm xuất hiện (0.025 mg/L) do sinh khối tôm tăng nhanh',
      desc: 'Sinh khối tôm tăng mạnh làm chất hữu cơ tích tụ, NO2 tăng nhẹ.',
      treatment: 'Tạt Yucca Schidigera (5L) kết hợp tăng thời gian chạy máy quạt nước.',
      supplies: [{ id: 'inv-chem-005', qty: 5 }],
    },
    {
      cropId: 'c1000000-0000-4000-8000-000000000003', pondId: POND_IDS.A3, doc: 68,
      title: 'Một số tôm bị đục cơ nhẹ sau khi kéo chài kiểm tra size',
      desc: 'Tôm búng mạnh trong chài bị đục cơ cục bộ khoảng 3%.',
      treatment: 'Tạt cấp tốc Vitamin C Anti-Stress (5kg) + Khoáng Max-Mineral (15kg).',
      supplies: [{ id: 'inv-med-003', qty: 5 }, { id: 'inv-chem-003', qty: 15 }],
    },
    {
      cropId: 'c1000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 82,
      title: 'Vỏ tôm có dấu hiệu bám rong nhớt nhẹ giai đoạn về đích',
      desc: 'Kiểm tra tôm thấy vỏ hơi nhám do chất lơ lửng bám vào râu và vỏ.',
      treatment: 'Sử dụng BKC 80% (2.5L) lúc trời nắng, hôm sau cấy vi sinh Bacillus.',
      supplies: [{ id: 'inv-chem-011', qty: 2.5 }, { id: 'inv-chem-004', qty: 1 }],
    },

    // === VỤ 2 (9 SỰ CỐ NẶNG: SỐC NHIỆT, PHÂN TRẮNG, AHPND, LỖ NẶNG, CẮT LỖ) ===
    {
      cropId: 'c2000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 6,
      title: 'Nắng gắt nhiệt độ nước chạm 33.5°C, tôm ương bị sốc nhiệt',
      desc: 'Nắng đầu hè gay gắt khiến ao ương tăng nhiệt đột ngột, tôm lờ đờ.',
      treatment: 'Tạt Vitamin C Anti-Stress (5kg), bật máy sục khí đáy tối đa công suất.',
      supplies: [{ id: 'inv-med-003', qty: 5 }],
    },
    {
      cropId: 'c2000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 24,
      title: 'Mưa giông trái mùa làm sập tảo đột ngột, pH tụt từ 8.2 xuống 7.3',
      desc: 'Trận mưa lớn đầu mùa làm nước ao chuyển màu trong đục, sập tảo toàn ao.',
      treatment: 'Tạt Vôi Canxi CaCO3 (75kg) + EDTA Super (10kg) cô lập độc tố sập tảo.',
      supplies: [{ id: 'inv-chem-002', qty: 75 }, { id: 'inv-chem-008', qty: 10 }],
    },
    {
      cropId: 'c2000000-0000-4000-8000-000000000002', pondId: POND_IDS.A2, doc: 33,
      title: 'Tảo lam bùng phát dạng hạt dày đặc, nổi váng xanh góc ao',
      desc: 'Thời tiết nắng nóng oi bức làm tảo lam độc bùng phát mạnh.',
      treatment: 'Đánh Thuốc tím KMnO4 (5kg) cắt tảo góc ao, sau đó cấy vi sinh Bacillus (2kg).',
      supplies: [{ id: 'inv-chem-010', qty: 5 }, { id: 'inv-chem-004', qty: 2 }],
    },
    {
      cropId: 'c2000000-0000-4000-8000-000000000003', pondId: POND_IDS.A3, doc: 42,
      title: 'Khí độc NH3 vọt lên 0.45 mg/L, tôm nổi đầu rải rác lúc sáng sớm',
      desc: 'Tảo tàn tích tụ đáy ao phân hủy sinh khí độc NH3 nguy hiểm.',
      treatment: 'Tạt cấp tốc Yucca Schidigera (10L) + Oxy viên Nano-O2 (15kg).',
      supplies: [{ id: 'inv-chem-005', qty: 10 }, { id: 'inv-chem-006', qty: 15 }],
    },
    {
      cropId: 'c2000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 47,
      title: 'BÙNG PHÁT DỊCH PHÂN TRẮNG (WFD), sợi phân trắng nổi đầy mặt nước',
      desc: 'Tôm đi phân trắng nổi kín góc cuối gió, ruột tôm đứt khúc lỏng lẻo.',
      treatment: 'Cắt 50% cữ cám, trộn Thảo dược đặc trị phân trắng Bactogut (3L) + Tỏi đen Allicin (3L).',
      supplies: [{ id: 'inv-med-004', qty: 3 }, { id: 'inv-med-005', qty: 3 }],
    },
    {
      cropId: 'c2000000-0000-4000-8000-000000000002', pondId: POND_IDS.A2, doc: 52,
      title: 'XUẤT HIỆN HOẠI TỬ GAN TỤY CẤP (AHPND), gan teo nhạt màu, ruột rỗng',
      desc: 'Tôm bỏ ăn, quan sát gan thấy teo đen hoặc nhạt màu, ruột không có thức ăn.',
      treatment: 'Đánh Thảo dược bổ gan Hepasol Extra (5L) tạt ao và trộn thức ăn liều cao.',
      supplies: [{ id: 'inv-med-001', qty: 5 }],
    },
    {
      cropId: 'c2000000-0000-4000-8000-000000000003', pondId: POND_IDS.A3, doc: 59,
      title: 'Khí độc NO2 bùng phát mất kiểm soát (0.085 mg/L), tôm lờ đờ tấp bờ',
      desc: 'NO2 tăng vọt làm tôm ngộ độc máu, mang tôm thâm đen.',
      treatment: 'Tạt Yucca (10L) + Mật rỉ đường EM1 (30L) + thay 20% nước tầng mặt.',
      supplies: [{ id: 'inv-chem-005', qty: 10 }, { id: 'inv-chem-009', qty: 30 }],
    },
    {
      cropId: 'c2000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 67,
      title: 'Tôm lột xác đồng loạt nhưng dính vỏ, rớt đáy rải rác',
      desc: 'Tôm kiệt sức sau dịch bệnh không thể rút vỏ hoàn chỉnh, tôm chết rớt đáy.',
      treatment: 'Tạt Khoáng Max-Mineral (30kg) + Vôi Dolomite (100kg) cấp cứu.',
      supplies: [{ id: 'inv-chem-003', qty: 30 }, { id: 'inv-chem-001', qty: 100 }],
    },
    {
      cropId: 'c2000000-0000-4000-8000-000000000002', pondId: POND_IDS.A2, doc: 74,
      title: 'Tôm chậm lớn (ABW chỉ 19g), FCR vọt lên 1.82, sức khỏe suy kiệt',
      desc: 'Đánh giá kỹ thuật: dịch bệnh tái phát nhiều lần, tôm còi cọc, chi phí tăng cao.',
      treatment: 'Họp khẩn cấp trang trại, Quản lý quyết định THU HOẠCH SỚM CẮT LỖ ở DOC 75.',
      supplies: [],
    },

    // === VỤ 3 (8 SỰ CỐ MÙA MƯA HÈ THU, KIỂM SOÁT TỐT, LỜI ÍT) ===
    {
      cropId: 'c3000000-0000-4000-8000-000000000001', pondId: POND_IDS.B1, doc: 12,
      title: 'Nước mưa làm giảm độ mặn đột ngột từ 18 ppt xuống 13 ppt',
      desc: 'Mưa liên tục làm phân tầng nước ngọt trên bề mặt ao ương.',
      treatment: 'Bổ sung khoáng Zeolite (40kg) và xả tràn nước ngọt tầng mặt.',
      supplies: [{ id: 'inv-chem-007', qty: 40 }],
    },
    {
      cropId: 'c3000000-0000-4000-8000-000000000001', pondId: POND_IDS.B1, doc: 26,
      title: 'Mưa dầm liên tục 3 ngày làm độ kiềm tụt xuống 110 mg/L',
      desc: 'Mưa kéo dài làm tụt kiềm, tôm lột vỏ bị mềm.',
      treatment: 'Đánh Vôi Dolomite Super (75kg) ban đêm để nâng kiềm lên 130 mg/L.',
      supplies: [{ id: 'inv-chem-001', qty: 75 }],
    },
    {
      cropId: 'c3000000-0000-4000-8000-000000000002', pondId: POND_IDS.B2, doc: 35,
      title: 'Tôm có hiện tượng cong thân đục cơ khi nhiệt độ nước thay đổi nhanh',
      desc: 'Nắng gắt sau mưa làm nhiệt độ thay đổi đột ngột khiến tôm bị đục cơ 4%.',
      treatment: 'Tạt Khoáng Premix Max-Mineral (20kg) + Vitamin C Anti-Stress (5kg).',
      supplies: [{ id: 'inv-chem-003', qty: 20 }, { id: 'inv-med-003', qty: 5 }],
    },
    {
      cropId: 'c3000000-0000-4000-8000-000000000003', pondId: POND_IDS.B3, doc: 45,
      title: 'Nhớt bạt đáy ao tích tụ, tôm quẫy bùn đen',
      desc: 'Bạt ao bị nhớt do chất hữu cơ bám dính quanh rãnh siphon.',
      treatment: 'Rải Men vi sinh Bacillus Subtilis (1.5kg) trực tiếp xuống vùng bùn đen.',
      supplies: [{ id: 'inv-chem-004', qty: 1.5 }],
    },
    {
      cropId: 'c3000000-0000-4000-8000-000000000001', pondId: POND_IDS.B1, doc: 55,
      title: 'Đường ruột tôm có đốm mủ nhẹ do vi khuẩn Vibrio',
      desc: 'Kiểm tra tôm thấy ruột có vài đốm trắng mủ nhỏ, tôm giảm ăn nhẹ.',
      treatment: 'Trộn Tỏi đen Allicin (2L) + Men tiêu hóa Probiotic (1kg) vào cám số 3.',
      supplies: [{ id: 'inv-med-005', qty: 2 }, { id: 'inv-med-002', qty: 1 }],
    },
    {
      cropId: 'c3000000-0000-4000-8000-000000000002', pondId: POND_IDS.B2, doc: 64,
      title: 'NO2 tăng nhẹ (0.028 mg/L) do mưa làm chậm chu trình nitrat hóa',
      desc: 'Thời tiết âm u kéo dài làm vi sinh nitrat hóa suy giảm hoạt tính.',
      treatment: 'Tạt Yucca Schidigera (5L) + bón Mật rỉ đường EM1 (15L).',
      supplies: [{ id: 'inv-chem-005', qty: 5 }, { id: 'inv-chem-009', qty: 15 }],
    },
    {
      cropId: 'c3000000-0000-4000-8000-000000000003', pondId: POND_IDS.B3, doc: 73,
      title: 'Tôm lột vỏ không đều, một số con bị mềm vỏ kéo dài',
      desc: 'Đàn tôm lột xác rải rác làm tôm nhỏ bị chèn ép bắt mồi.',
      treatment: 'Tạt Canxi CaCO3 (50kg) + Khoáng Max-Mineral (15kg).',
      supplies: [{ id: 'inv-chem-002', qty: 50 }, { id: 'inv-chem-003', qty: 15 }],
    },
    {
      cropId: 'c3000000-0000-4000-8000-000000000001', pondId: POND_IDS.B1, doc: 80,
      title: 'Đốm đen nhẹ rải rác trên vỏ tôm do thiếu khoáng',
      desc: 'Một số cá thể có đốm đen mòn đuôi nhẹ giai đoạn cuối vụ.',
      treatment: 'Tạt BKC 80% (2L) diệt khuẩn ngoài vỏ, hôm sau tạt khoáng tăng cường.',
      supplies: [{ id: 'inv-chem-011', qty: 2 }],
    },

    // === VỤ 4 (8 SỰ CỐ VỤ HIỆN TẠI ĐANG ACTIVE Ở NGÀY 90) ===
    {
      cropId: 'c0000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 14,
      title: 'Mưa giông lớn làm tụt pH và kiềm',
      desc: 'Cơn mưa giông lúc 14h làm pH tụt từ 8.1 xuống 7.4.',
      treatment: 'Tạt Vôi Dolomite (50kg) + Vitamin C Anti-Stress (5kg).',
      supplies: [{ id: 'inv-chem-001', qty: 50 }, { id: 'inv-med-003', qty: 5 }],
    },
    {
      cropId: 'c0000000-0000-4000-8000-000000000002', pondId: POND_IDS.A2, doc: 32,
      title: 'Tảo phát triển quá dày, ban ngày pH vọt lên 8.7',
      desc: 'Nắng gắt làm tảo phát triển mạnh, biên độ pH dao động lớn trong ngày.',
      treatment: 'Tạt Mật rỉ đường EM1 (20L) lúc chiều mát để hãm tảo.',
      supplies: [{ id: 'inv-chem-009', qty: 20 }],
    },
    {
      cropId: 'c0000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 42,
      title: 'SỰ CỐ ĐỨT DÂY CUROA MÁY QUẠT NƯỚC BAN ĐÊM, Oxy tụt xuống 3.3 mg/L',
      desc: 'Quạt nước ngưng lúc 2h sáng do đứt dây curoa, DO giảm nhanh.',
      treatment: 'Bật máy sục khí dự phòng, tạt cấp cứu Oxy viên Nano-O2 (10kg) và Yucca (5L).',
      supplies: [{ id: 'inv-chem-006', qty: 10 }, { id: 'inv-chem-005', qty: 5 }],
    },
    {
      cropId: 'c0000000-0000-4000-8000-000000000003', pondId: POND_IDS.A3, doc: 51,
      title: 'Tôm giảm ăn nhẹ sau chu kỳ lột xác lớn',
      desc: 'Tôm lột xác đồng loạt ban đêm, cữ sáng ăn chậm 20%.',
      treatment: 'Trộn Men tiêu hóa Probiotic (1.5kg) + Thảo dược bổ gan Hepasol (2L).',
      supplies: [{ id: 'inv-med-002', qty: 1.5 }, { id: 'inv-med-001', qty: 2 }],
    },
    {
      cropId: 'c0000000-0000-4000-8000-000000000002', pondId: POND_IDS.A2, doc: 62,
      title: 'Tích tụ chất thải cuối vụ làm NO2 chạm ngưỡng cảnh báo (0.035 mg/L)',
      desc: 'Sinh khối tôm lớn khiến siphon chất thải quá tải, NO2 tăng.',
      treatment: 'Cấy vi sinh Bacillus Subtilis (2kg) liều cao kết hợp tạt Yucca (5L).',
      supplies: [{ id: 'inv-chem-004', qty: 2 }, { id: 'inv-chem-005', qty: 5 }],
    },
    {
      cropId: 'c0000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 71,
      title: 'Hiện tượng đục cơ nhẹ ở vài cá thể khi gom mẫu chài',
      desc: 'Kiểm tra chài mẫu phát hiện khoảng 2% tôm bị trắng đuôi nhẹ.',
      treatment: 'Tạt Khoáng Premix Max-Mineral (20kg) + Vitamin C (5kg).',
      supplies: [{ id: 'inv-chem-003', qty: 20 }, { id: 'inv-med-003', qty: 5 }],
    },
    {
      cropId: 'c0000000-0000-4000-8000-000000000003', pondId: POND_IDS.A3, doc: 79,
      title: 'Nhớt bạt đáy ao quanh vùng siphon gom chất thải',
      desc: 'Bạt đáy tích tụ nhớt hữu cơ cuối vụ.',
      treatment: 'Xả siphon tăng cường, tạt vi sinh đáy ao Bacillus (1.5kg).',
      supplies: [{ id: 'inv-chem-004', qty: 1.5 }],
    },
    {
      cropId: 'c0000000-0000-4000-8000-000000000001', pondId: POND_IDS.A1, doc: 87,
      title: 'Tôm đạt kích cỡ lớn 20 con/kg, nhu cầu oxy cực cao',
      desc: 'Sinh khối ao đạt hơn 4 tấn, tôm thở mạnh lúc rạng sáng.',
      treatment: 'Tăng cường 100% công suất dàn quạt và trộn Gluca-Shield tăng cường miễn dịch về đích.',
      supplies: [{ id: 'inv-med-006', qty: 5 }],
    },

    // === VỤ ƯƠNG B1 (2 SỰ CỐ NHẸ GIAI ĐOẠN ƯƠNG DƯỠNG) ===
    {
      cropId: 'c0000000-0000-4000-8000-000000000010', pondId: POND_IDS.B1, doc: 7,
      title: 'Độ kiềm dao động nhẹ trong ao ương sau cơn mưa chiều (kiềm 120 mg/L)',
      desc: 'Mưa làm giảm nhẹ độ kiềm trong ao ương tôm giống.',
      treatment: 'Tạt Vôi Dolomite Super (25kg) ổn định hệ đệm nước.',
      supplies: [{ id: 'inv-chem-001', qty: 25 }],
    },
    {
      cropId: 'c0000000-0000-4000-8000-000000000010', pondId: POND_IDS.B1, doc: 16,
      title: 'Tôm ương lột vỏ đồng loạt ở ngày 16, cần bổ sung khoáng',
      desc: 'Đàn tôm giống lột vỏ sang giai đoạn lớn, cần bổ sung khoáng tăng cứng vỏ.',
      treatment: 'Tạt Khoáng Premix Max-Mineral (10kg) + Vitamin C (3kg).',
      supplies: [{ id: 'inv-chem-003', qty: 10 }, { id: 'inv-med-003', qty: 3 }],
    },
  ];

  const exportLogs = [];
  const treatmentUpdatesBatch = [];

  for (let i = 0; i < incidentDefinitions.length; i++) {
    const inc = incidentDefinitions[i];
    const crop = cropsSetup.find((c) => c.id === inc.cropId);
    let offsetDays = inc.doc - 1;
    if (crop.parentCropId) {
      offsetDays = Math.max(0, inc.doc - 21);
    }
    const incidentDate = addDays(crop.startDate, offsetDays);
    const incidentId = `inc-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;

    // Tạo sự cố
    await prisma.incident.upsert({
      where: { id: incidentId },
      update: {
        title: inc.title,
        description: inc.desc,
        treatment: inc.treatment,
        status: 'RESOLVED',
        cropId: inc.cropId,
        reporterId: technician.id,
        assignedToId: technician.id,
        startedAt: incidentDate,
        resolvedAt: addDays(incidentDate, 1, 17, 0),
        createdAt: incidentDate,
      },
      create: {
        id: incidentId,
        title: inc.title,
        description: inc.desc,
        treatment: inc.treatment,
        status: 'RESOLVED',
        cropId: inc.cropId,
        reporterId: technician.id,
        assignedToId: technician.id,
        startedAt: incidentDate,
        resolvedAt: addDays(incidentDate, 1, 17, 0),
        createdAt: incidentDate,
      },
    });

    // Nhật ký cập nhật quá trình điều trị
    treatmentUpdatesBatch.push({
      incidentId,
      authorId: technician.id,
      treatment: inc.treatment,
      observation: `Tình trạng tôm và nước ao sau khi xử lý: ${inc.desc}`,
      result: 'Tôm ổn định, các chỉ số môi trường trở về ngưỡng an toàn 5T.',
      status: 'RESOLVED',
      eventType: 'TREATMENT',
      createdAt: addDays(incidentDate, 0, 16, 0),
    });

    // Vật tư xuất kho thực tế phục vụ xử lý sự cố (lưu trong inventory_usage_logs)
    for (const sup of inc.supplies) {
      exportLogs.push({
        inventoryId: sup.id,
        quantityUsed: sup.qty,
        usageDate: incidentDate,
        notes: `[XUẤT KHO ĐIỀU TRỊ] Sự cố: ${inc.title} — Ao ${pondsData.find((p) => p.id === inc.pondId).name}`,
        pondId: inc.pondId,
        cropId: inc.cropId,
        createdBy: technician.id,
      });

      inventoryUsageTracker[sup.id] += sup.qty;
    }
  }

  await prisma.incidentTreatmentUpdate.createMany({ data: treatmentUpdatesBatch });
  console.log(`  ✔ Đã thiết lập xong 35 sự cố và cập nhật phác đồ điều trị thành công.`);

  // ---------------------------------------------------------------------------
  // BƯỚC 8: VẬN HÀNH HÀNG NGÀY CHO 13 VỤ NUÔI (CHO ĂN, NƯỚC, SỨC KHỎE, CHÀI SINH KHỐI)
  // ---------------------------------------------------------------------------
  console.log('\n[8/12] ⚙️ Khởi tạo dữ liệu vận hành hàng ngày (Cho ăn, Môi trường, Sức khỏe, Chài mẫu)...');

  const nurserySessions = ['SESSION_1', 'SESSION_2', 'SESSION_3', 'SESSION_4'];
  const commercialSessions = ['SESSION_1', 'SESSION_2', 'SESSION_3', 'SESSION_4'];
  const sessionTimes = {
    SESSION_1: '07:00',
    SESSION_2: '11:00',
    SESSION_3: '15:30',
    SESSION_4: '19:30',
  };

  const feedingLogsBatch = [];
  const waterRecordsBatch = [];
  const healthRecordsBatch = [];
  const sizeSamplesBatch = [];
  const mortalityLogsBatch = [];

  // Tạo dữ liệu cho từng vụ nuôi
  for (const crop of cropsSetup) {
    const isPureNursery = crop.stage === 'NURSERY';
    const isRootContinuous = !crop.parentCropId && !isPureNursery;

    let totalDays = 70;
    if (isPureNursery) {
      totalDays = 20;
    } else if (isRootContinuous) {
      if (crop.id.startsWith('c1')) totalDays = 90;
      else if (crop.id.startsWith('c2')) totalDays = 75;
      else if (crop.id.startsWith('c3')) totalDays = 86;
      else totalDays = 89;
    } else {
      if (crop.id.startsWith('c1')) totalDays = 70;
      else if (crop.id.startsWith('c2')) totalDays = 55;
      else if (crop.id.startsWith('c3')) totalDays = 66;
      else totalDays = 69;
    }

    for (let day = 1; day <= totalDays; day++) {
      const currentDate = addDays(crop.startDate, day - 1);

      let doc = day;
      if (!isPureNursery && !isRootContinuous) {
        doc = day + 20;
      }

      const isInNurseryPhase = isPureNursery || (isRootContinuous && day <= 20);

      // 1. NHẬT KÝ CHO ĂN HÀNG NGÀY (FEEDING LOGS)
      let feedId = 'inv-feed-001';
      if (isInNurseryPhase) {
        feedId = doc <= 10 ? 'inv-feed-001' : 'inv-feed-002';
      } else {
        if (doc <= 35) feedId = 'inv-feed-002';
        else if (doc <= 55) feedId = 'inv-feed-003';
        else if (doc <= 75) feedId = 'inv-feed-004';
        else feedId = 'inv-feed-005';
      }

      const sessions = isInNurseryPhase ? nurserySessions : commercialSessions;
      const dailyFeedBase = isInNurseryPhase ? 15 : 65;
      const feedGrowthFactor = isInNurseryPhase ? 1 + doc * 0.12 : 1 + ((doc - 20) / 70) * 1.8;
      const dayFeedTotal = dailyFeedBase * feedGrowthFactor;
      const sessionFeedAmount = Number((dayFeedTotal / sessions.length).toFixed(2));

      for (const ses of sessions) {
        feedingLogsBatch.push({
          farmId: farm.id,
          pondId: crop.pondId,
          cropId: crop.id,
          feedProductId: feedId,
          feedingDate: currentDate,
          feedingSession: ses,
          feedingTime: sessionTimes[ses],
          feedAmount: sessionFeedAmount,
          feedingMethod: isInNurseryPhase ? 'MANUAL' : (ses === 'SESSION_2' || ses === 'SESSION_4' ? 'AUTO' : 'MANUAL'),
          feedingStatus: 'COMPLETED',
          note: `Cữ ăn bình thường, tôm ăn khỏe, đạt 100% thức ăn dự kiến`,
          createdBy: farmer.id,
        });
      }

      // Xuất kho cám ăn hàng ngày (ghi nhận 1 phiếu tổng hợp mỗi ngày cho ao)
      exportLogs.push({
        inventoryId: feedId,
        quantityUsed: Number(dayFeedTotal.toFixed(2)),
        usageDate: currentDate,
        notes: `Xuất cám cho ăn ngày DOC ${doc} (${isInNurseryPhase ? 'Ao Ương' : 'Ao Nuôi'})`,
        pondId: crop.pondId,
        cropId: crop.id,
        createdBy: farmer.id,
      });
      inventoryUsageTracker[feedId] += dayFeedTotal;

      // 2. ĐO CHẤT LƯỢNG NƯỚC HÀNG NGÀY (2 LẦN/NGÀY: 07:00 & 15:30)
      const isIncidentDay = (crop.id.startsWith('c2') && doc >= 45 && doc <= 55);
      const morningRecordTime = addDays(crop.startDate, day - 1, 7, 0);
      const afternoonRecordTime = addDays(crop.startDate, day - 1, 15, 30);

      // Buổi sáng
      waterRecordsBatch.push({
        pondId: crop.pondId,
        recordTime: morningRecordTime,
        temperature: isIncidentDay ? 32.8 : 28.5 + (day % 3) * 0.4,
        ph: isIncidentDay ? 7.4 : 7.8 + (day % 3) * 0.1,
        dissolvedOxygen: (doc === 42 && crop.id.endsWith('0001')) ? 3.3 : 5.8 + (day % 2) * 0.3,
        salinity: 18.0 + (day % 4) * 0.5,
        alkalinity: isIncidentDay ? 110 : 135 + (day % 5) * 2,
        nh3: isIncidentDay ? 0.35 : 0.02 + (day % 2) * 0.01,
        no2: isIncidentDay ? 0.065 : 0.01 + (day % 3) * 0.005,
        h2s: 0.002,
        transparency: isIncidentDay ? 22 : 35 + (day % 4),
        waterColor: isIncidentDay ? 'Nâu sẫm vẩn đục' : 'Nước trà tảo khuê',
        note: isIncidentDay ? 'Cảnh báo: Tảo tàn, khí độc NH3 và NO2 vọt cao' : 'Các chỉ số môi trường nằm trong ngưỡng tối ưu 5T',
        createdBy: technician.id,
      });

      // Buổi chiều
      waterRecordsBatch.push({
        pondId: crop.pondId,
        recordTime: afternoonRecordTime,
        temperature: isIncidentDay ? 34.0 : 31.0 + (day % 3) * 0.5,
        ph: isIncidentDay ? 8.6 : 8.1 + (day % 3) * 0.1,
        dissolvedOxygen: 6.5 + (day % 3) * 0.3,
        salinity: 18.2 + (day % 4) * 0.5,
        alkalinity: isIncidentDay ? 115 : 138 + (day % 5) * 2,
        nh3: isIncidentDay ? 0.40 : 0.03 + (day % 2) * 0.01,
        no2: isIncidentDay ? 0.070 : 0.012 + (day % 3) * 0.005,
        h2s: 0.003,
        transparency: isIncidentDay ? 20 : 34 + (day % 4),
        waterColor: isIncidentDay ? 'Nâu đỏ' : 'Nước trà xanh lơ',
        note: 'Đo chiều: Nhiệt độ tăng, DO cao do quang hợp',
        createdBy: technician.id,
      });

      // 3. SỨC KHỎE TÔM HÀNG NGÀY (SHRIMP HEALTH RECORDS)
      let healthStatus = 'NORMAL';
      let severity = 'NORMAL';
      let affectedPct = 0;
      let healthNote = 'Tôm bơi lội nhanh nhẹn, đường ruột to đều, màu gan nâu đen bóng.';

      if (crop.id.startsWith('c2') && doc >= 45 && doc <= 55) {
        healthStatus = 'LETHARGIC';
        severity = 'SEVERE';
        affectedPct = 25.5;
        healthNote = 'Tôm lờ đờ tấp mé, phân trắng nổi mặt nước, gan nhạt màu, ruột đứt khúc.';
        mortalityLogsBatch.push({
          cropId: crop.id,
          recordedDate: currentDate,
          deadQuantityPcs: Math.round(150 + Math.random() * 200),
          cause: 'Bệnh hoại tử gan tụy cấp và phân trắng',
          note: 'Vớt xác tôm chết đáy ao và hố siphon cữ sáng',
          createdBy: farmer.id,
        });
      } else if (doc === 42 && crop.id.endsWith('0001')) {
        healthStatus = 'LETHARGIC';
        severity = 'MILD';
        affectedPct = 5.0;
        healthNote = 'Tôm hơi mệt do oxy tụt nhẹ lúc đứt quạt ban đêm, đã hồi phục sau khi tạt oxy viên.';
      }

      healthRecordsBatch.push({
        farmId: farm.id,
        pondId: crop.pondId,
        cropId: crop.id,
        recordTime: addDays(crop.startDate, day - 1, 10, 0),
        healthStatus,
        severity,
        affectedPercentage: affectedPct,
        note: healthNote,
        recordedBy: technician.id,
      });

      // 4. LẤY MẪU KÍCH CỠ TÔM & CHÀI SINH KHỐI (CỨ 5 NGÀY 1 LẦN)
      if (day % 5 === 0 || day === totalDays) {
        let targetAbw = 0;
        if (isInNurseryPhase) {
          targetAbw = Number((0.02 + (doc / 20) * 3.5).toFixed(2));
        } else {
          const maxWeight = crop.id.startsWith('c1') ? 48.0 : (crop.id.startsWith('c2') ? 19.3 : (crop.id.startsWith('c3') ? 29.7 : 45.0));
          const daysInCommercial = isRootContinuous ? (totalDays - 20) : totalDays;
          const currentCommercialDay = isRootContinuous ? (day - 20) : day;
          targetAbw = Number((3.5 + (currentCommercialDay / daysInCommercial) * (maxWeight - 3.5)).toFixed(2));
        }

        const sizePcsKg = Number((1000 / targetAbw).toFixed(1));
        const sampleCount = 50;
        const sampleWeightG = Number((targetAbw * sampleCount).toFixed(2));
        const adg = Number((targetAbw / doc).toFixed(2));

        const avgCountPerCast = Math.round(sampleCount / 5);
        const castDetails = [
          { castNo: 1, shrimpCount: avgCountPerCast + 2, weightG: Number(((avgCountPerCast + 2) * targetAbw).toFixed(1)) },
          { castNo: 2, shrimpCount: avgCountPerCast - 1, weightG: Number(((avgCountPerCast - 1) * targetAbw).toFixed(1)) },
          { castNo: 3, shrimpCount: avgCountPerCast + 3, weightG: Number(((avgCountPerCast + 3) * targetAbw).toFixed(1)) },
          { castNo: 4, shrimpCount: avgCountPerCast, weightG: Number((avgCountPerCast * targetAbw).toFixed(1)) },
          { castNo: 5, shrimpCount: avgCountPerCast - 2, weightG: Number(((avgCountPerCast - 2) * targetAbw).toFixed(1)) },
        ];

        const estimatedTotalShrimp = Math.round(crop.initialShrimpCount * (1 - (doc / 120) * 0.15));
        const estimatedBiomassKg = Number(((estimatedTotalShrimp * targetAbw) / 1000).toFixed(1));

        sizeSamplesBatch.push({
          pondId: crop.pondId,
          samplingDate: currentDate,
          doc,
          sampleCount,
          sampleWeightGram: sampleWeightG,
          sampleLengthCm: Number((3 + Math.sqrt(targetAbw) * 1.8).toFixed(1)),
          abwGram: targetAbw,
          sizePerKg: sizePcsKg,
          adgGramPerDay: adg,
          netAreaSqM: 6.25,
          castDetails,
          estimatedTotalShrimp,
          estimatedBiomassKg,
          notes: `Lấy mẫu chài định kỳ ngày DOC ${doc}, tôm đồng đều, vỏ cứng sáng bóng.`,
        });
      }
    }
  }

  // Batch insert dữ liệu vận hành để hoàn tất siêu tốc
  console.log(`  -> Đang lưu ${feedingLogsBatch.length} cữ cho ăn...`);
  await prisma.feedingLog.createMany({ data: feedingLogsBatch, skipDuplicates: true });

  console.log(`  -> Đang lưu ${waterRecordsBatch.length} bản ghi đo môi trường nước 5T...`);
  await prisma.waterQualityRecord.createMany({ data: waterRecordsBatch, skipDuplicates: true });

  console.log(`  -> Đang lưu ${healthRecordsBatch.length} bản ghi theo dõi sức khỏe tôm...`);
  await prisma.shrimpHealthRecord.createMany({ data: healthRecordsBatch, skipDuplicates: true });

  console.log(`  -> Đang lưu ${sizeSamplesBatch.length} đợt chài mẫu tăng trưởng & sinh khối...`);
  await prisma.shrimpSizeSample.createMany({ data: sizeSamplesBatch, skipDuplicates: true });

  if (mortalityLogsBatch.length > 0) {
    console.log(`  -> Đang lưu ${mortalityLogsBatch.length} bản ghi vớt tôm chết đáy...`);
    await prisma.mortalityLog.createMany({ data: mortalityLogsBatch, skipDuplicates: true });
  }

  console.log(`  -> Đang lưu ${exportLogs.length} phiếu xuất kho phục vụ ăn hàng ngày & sự cố...`);
  await prisma.inventoryUsageLog.createMany({ data: exportLogs, skipDuplicates: true });

  // ---------------------------------------------------------------------------
  // BƯỚC 9: HỆ THỐNG THÔNG BÁO TỰ ĐỘNG (NOTIFICATIONS)
  // ---------------------------------------------------------------------------
  console.log('\n[9/12] 🔔 Khởi tạo 21 thông báo hệ thống tự động theo ngữ cảnh...');

  const notificationData = [
    { level: 'INFO', title: 'Khởi động Vụ 1 thành công', msg: 'Thả 300.000 con giống PL12 vào Ao ương A1 bắt đầu chu kỳ nuôi 5T.', pId: POND_IDS.A1, uId: manager.id, dt: parseDate('2025-09-15') },
    { level: 'INFO', title: 'Tách ao thành công', msg: 'Thu hoạch ao ương A1 đạt 288.000 con (96%), hoàn thành tách sang 3 ao A1, A2, A3.', pId: POND_IDS.A1, uId: technician.id, dt: parseDate('2025-10-05') },
    { level: 'WARNING', title: 'Cảnh báo tụt kiềm sau mưa', msg: 'Độ kiềm Ao A2 tụt xuống 105 mg/L sau cơn mưa rào, đề nghị tạt Dolomite.', pId: POND_IDS.A2, uId: technician.id, dt: parseDate('2025-11-02') },
    { level: 'INFO', title: 'Đạt đỉnh thu hoạch Vụ 1', msg: 'Vụ 1 thu hoạch 10.8 tấn, doanh thu 1.782 tỷ đồng, lãi ròng 732 triệu đồng.', pId: POND_IDS.A1, uId: manager.id, dt: parseDate('2025-12-14') },
    { level: 'DANGER', title: 'Cảnh báo dịch phân trắng Vụ 2', msg: 'Phát hiện sợi phân trắng nổi góc ao A1 và A2, đề xuất cắt 50% thức ăn và trị Bactogut.', pId: POND_IDS.A1, uId: technician.id, dt: parseDate('2026-04-16') },
    { level: 'DANGER', title: 'Khí độc NH3 vượt ngưỡng nguy hiểm', msg: 'Nồng độ NH3 Ao A3 đạt 0.45 mg/L, nguy cơ ngạt tôm, tạt cấp cứu Yucca và Oxy viên.', pId: POND_IDS.A3, uId: farmer.id, dt: parseDate('2026-04-11') },
    { level: 'WARNING', title: 'Quyết định thu hoạch sớm Vụ 2', msg: 'Quản lý phê duyệt thu hoạch sớm ở DOC 75 để cắt lỗ 255.5 triệu đồng.', pId: POND_IDS.A1, uId: manager.id, dt: parseDate('2026-05-15') },
    { level: 'INFO', title: 'Khởi động Vụ 3 khu B', msg: 'Thả giống 300.000 con PL12 vào Ao B1 theo quy trình xử lý nước mới.', pId: POND_IDS.B1, uId: manager.id, dt: parseDate('2026-04-15') },
    { level: 'INFO', title: 'Thu hoạch có lãi Vụ 3', msg: 'Vụ 3 về đích an toàn, sản lượng 6 tấn, ghi nhận lãi ròng 75 triệu đồng.', pId: POND_IDS.B1, uId: manager.id, dt: parseDate('2026-07-10') },
    { level: 'INFO', title: 'Khởi tạo Vụ 4 công nghệ cao', msg: 'Thả 300.000 con giống PL12 vào Ao A1, bắt đầu vụ nuôi chính vụ 2026.', pId: POND_IDS.A1, uId: manager.id, dt: parseDate('2026-07-17') },
    { level: 'WARNING', title: 'Mưa lớn tụt pH Ao A1', msg: 'pH tụt xuống 7.4 sau cơn giông, đã chỉ đạo tạt vôi Dolomite và Vitamin C.', pId: POND_IDS.A1, uId: technician.id, dt: parseDate('2026-07-30') },
    { level: 'INFO', title: 'Tách ao Vụ 4 thành công', msg: 'Chuyển 285.000 con tôm ương sang 3 ao A1, A2, A3 (size 277 con/kg).', pId: POND_IDS.A1, uId: farmer.id, dt: parseDate('2026-08-06') },
    { level: 'DANGER', title: 'Sự cố đứt curoa máy quạt đêm', msg: 'DO Ao A1 tụt xuống 3.3 mg/L lúc 2h sáng, đã kích hoạt sục khí dự phòng và oxy viên.', pId: POND_IDS.A1, uId: technician.id, dt: parseDate('2026-09-16') },
    { level: 'WARNING', title: 'Cảnh báo NO2 chạm ngưỡng 0.035 mg/L', msg: 'Ao A2 ghi nhận NO2 tăng do chất hữu cơ, cấy vi sinh Bacillus đậm đặc.', pId: POND_IDS.A2, uId: technician.id, dt: parseDate('2026-10-06') },
    { level: 'INFO', title: 'Khởi động Vụ Ương Mới tại Ao B1', msg: 'Thả 300.000 con giống PL12 vào Ao ương B1 ngày 24/09/2026. Đã đạt 20 ngày nuôi, sẵn sàng tách ao.', pId: POND_IDS.B1, uId: manager.id, dt: parseDate('2026-09-24') },
    { level: 'INFO', title: 'Tôm Ao A1 đạt size đại 20 con/kg', msg: 'Chài sinh khối ngày 89 đạt ABW 48.5g (size 20.6 con/kg), chuẩn bị thu hoạch.', pId: POND_IDS.A1, uId: manager.id, dt: parseDate('2026-10-12') },
    { level: 'INFO', title: 'Ao A2 sẵn sàng thu hoạch', msg: 'Ao A2 đạt sinh khối ước tính 3.65 tấn (size 22.4 con/kg), sẵn sàng mở form thu hoạch.', pId: POND_IDS.A2, uId: manager.id, dt: parseDate('2026-10-13') },
    { level: 'INFO', title: 'Ao A3 đạt kế hoạch sản lượng', msg: 'Ao A3 đạt sản lượng ước tính 3.4 tấn (size 25.1 con/kg), sẵn sàng thu hoạch.', pId: POND_IDS.A3, uId: manager.id, dt: parseDate('2026-10-14') },
    { level: 'WARNING', title: 'Cảnh báo lượng tồn kho Cám số 2', msg: 'Cám số 2 còn 1.85 tấn trong kho, đề nghị lên đơn đặt hàng nhập mới.', pId: POND_IDS.A1, uId: manager.id, dt: parseDate('2026-10-14') },
    { level: 'INFO', title: 'Đã sao lưu dữ liệu toàn hệ thống', msg: 'Dữ liệu 4 vụ nuôi và kho vật tư được đồng bộ an toàn trên đám mây.', pId: POND_IDS.A1, uId: admin.id, dt: parseDate('2026-10-14') },
    { level: 'INFO', title: 'Báo cáo chi tiết vụ nuôi sẵn sàng', msg: 'Báo cáo chi tiết 7 tabs của 4 vụ nuôi đã được tổng hợp phân tích kỹ thuật và tài chính.', pId: POND_IDS.A1, uId: manager.id, dt: parseDate('2026-10-14') },
  ];

  for (const n of notificationData) {
    await prisma.notification.create({
      data: {
        title: n.title,
        message: n.msg,
        level: n.level,
        farmId: farm.id,
        pondId: n.pId,
        userId: n.uId,
        isRead: false,
        createdAt: n.dt,
      },
    });
  }
  console.log(`  ✔ Đã lưu ${notificationData.length} thông báo theo diễn biến thời gian.`);

  // ---------------------------------------------------------------------------
  // BƯỚC 10: TỰ ĐỘNG CẬP NHẬT TỒN KHO THỰC TẾ (INVENTORY BALANCE UPDATE)
  // ---------------------------------------------------------------------------
  console.log('\n[10/12] 📊 Tự động cân đối tồn kho hiện tại (Nhập - Xuất)...');

  for (const inv of inventoryDefinitions) {
    const totalImport = importLogs
      .filter((l) => l.inventoryId === inv.id)
      .reduce((sum, l) => sum + l.quantityUsed, 0);

    const totalExport = exportLogs
      .filter((l) => l.inventoryId === inv.id)
      .reduce((sum, l) => sum + l.quantityUsed, 0);

    const finalStock = Number((totalImport - totalExport).toFixed(2));
    const pkgQty = inv.weightPerPkg > 0 ? Number((finalStock / inv.weightPerPkg).toFixed(1)) : null;

    await prisma.inventory.update({
      where: { id: inv.id },
      data: {
        quantity: Math.max(0, finalStock),
        packageQty: pkgQty,
      },
    });

    console.log(
      `  • ${inv.itemName.padEnd(55)} | Nhập: ${String(totalImport).padStart(7)} ${inv.unit} | Xuất: ${String(Number(totalExport.toFixed(1))).padStart(7)} ${inv.unit} | Tồn: ${String(finalStock).padStart(7)} ${inv.unit}`
    );
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 11: CƠ SỞ TRI THỨC CHATBOT RAG 5T (CHATBOT INTERACTIONS)
  // ---------------------------------------------------------------------------
  console.log('\n[11/12] 🤖 Nạp dữ liệu hỏi đáp mẫu cho Chatbot Trợ lý ảo RAG...');

  const chatbotPairs = [
    {
      q: 'Quy trình nuôi tôm Thuận Thiên 5T có những nguyên tắc cốt lõi nào?',
      a: 'Quy trình Thuận Thiên 5T gồm: 1. Đúng Giống (tôm khỏe, sạch bệnh), 2. Đúng Thức Ăn (đạm chuẩn theo ngày tuổi), 3. Đúng Môi Trường (kiềm >120, pH 7.5-8.3, DO >5.0), 4. Đúng Kỹ Thuật (ương 2 giai đoạn, siphon đáy sạch), 5. Đúng Tâm Thế (phòng bệnh hơn chữa bệnh, kiểm soát chặt chi phí).',
    },
    {
      q: 'Khi trời mưa giông làm tụt pH và độ kiềm thì phải xử lý khẩn cấp thế nào?',
      a: 'Bật toàn bộ quạt nước để chống phân tầng nước. Tạt Vôi Dolomite Super 30-50kg/1.000m3 để nâng kiềm, kết hợp tạt Canxi CaCO3 để nâng pH. Bổ sung Vitamin C Anti-Stress 3-5kg/1.000m3 để tôm không bị sốc nhiệt và mềm vỏ.',
    },
    {
      q: 'Tại sao FCR ở Vụ 2 bị vọt lên 1.83 gây thua lỗ nặng?',
      a: 'Do thời tiết nắng nóng đầu mùa gây sốc nhiệt làm sập tảo đột ngột, kéo theo bùng phát dịch phân trắng và hoại tử gan tụy cấp AHPND ở DOC 47-55. Tôm bỏ ăn nhưng không giảm cữ kịp thời, kết hợp chi phí thuốc điều trị tăng cao và tôm chậm lớn, buộc phải thu hoạch sớm ở DOC 75 để cắt lỗ.',
    },
    {
      q: 'Bí quyết giúp Vụ 1 đạt lợi nhuận kỷ lục 732 triệu đồng là gì?',
      a: 'Ương tôm 20 ngày đạt tỷ lệ sống 96%, kiểm soát chặt môi trường không để dịch bệnh bùng phát, duy trì độ kiềm 140 mg/L và bổ sung men vi sinh Bacillus định kỳ giúp tôm lột vỏ đồng loạt, đạt size thương phẩm siêu đại 20 con/kg với FCR chỉ 1.16.',
    },
    {
      q: 'Ao nuôi B1 đã ương được bao nhiêu ngày và có thể tách ao chưa?',
      a: 'Ao nuôi B1 được thả giống ngày 24/09/2026. Tính đến hôm nay (14/10/2026), ao đã nuôi được chính xác 20 ngày (DOC 20), tôm đạt kích cỡ chuẩn ~300 con/kg, tỷ lệ sống ước đạt 95%. Hệ thống đã kích hoạt nút "Tách ao", Quản lý có thể thực hiện tách sang các ao nuôi thương phẩm ngay.',
    },
  ];

  await prisma.knowledgeDocument.create({
    data: {
      title: 'Quy trình Nuôi tôm Thuận Thiên 5T & Cẩm nang Quản trị Rủi ro Dịch bệnh',
      category: 'GENERAL',
      fileName: 'quy-trinh-thuan-thien-5t.md',
      fileType: 'markdown',
      content: 'Tài liệu hướng dẫn quy trình nuôi tôm công nghệ cao 2 giai đoạn theo tiêu chuẩn Thuận Thiên 5T...',
      uploadedBy: manager.fullName,
      chunks: {
        create: chatbotPairs.map((cb, idx) => ({
          chunkIndex: idx + 1,
          content: `HỎI: ${cb.q}\nTRẢ LỜI: ${cb.a}`,
          metadata: { question: cb.q, answer: cb.a },
        })),
      },
    },
  });
  console.log(`  ✔ Đã nạp tài liệu và ${chatbotPairs.length} chunks tri thức chuẩn 5T cho RAG.`);

  // ---------------------------------------------------------------------------
  // BƯỚC 12: TỔNG KẾT VÀ BÁO CÁO THÀNH CÔNG
  // ---------------------------------------------------------------------------
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n========================================================================');
  console.log(`🎉 NẠP TOÀN BỘ DỮ LIỆU THÀNH CÔNG TRONG ${durationSec} GIÂY!`);
  console.log('========================================================================');
  console.log(`• Trang trại : Hoàng Anh Long (HIGH_TECH)`);
  console.log(`• Tài khoản  : hungncqde180400@fpt.edu.vn (Quản lý) | Mật khẩu: Password123@`);
  console.log(`• Cấu trúc   : 13 vụ nuôi liên tục (4 vụ 2 giai đoạn + 1 vụ ương B1 mới)`);
  console.log(`  - Vụ 1 (15/09/2025 - 14/12/2025): Ao A1 (90d), Ao A2 (70d), Ao A3 (70d) -> Lãi 732.000.000 đ`);
  console.log(`  - Vụ 2 (01/03/2026 - 15/05/2026): Ao A1 (75d), Ao A2 (55d), Ao A3 (55d) -> Lỗ -255.500.000 đ (Cắt lỗ)`);
  console.log(`  - Vụ 3 (15/04/2026 - 10/07/2026): Ao B1 (86d), Ao B2 (66d), Ao B3 (66d) -> Lãi 75.000.000 đ`);
  console.log(`  - Vụ 4 (17/07/2026 - 14/10/2026): Ao A1 (89d nuôi - DOC 90), Ao A2 (69d), Ao A3 (69d) -> ĐANG ACTIVE, SẴN SÀNG THU HOẠCH!`);
  console.log(`  - Vụ Ương B1 (24/09/2026 - 14/10/2026): Ao B1 (20d nuôi - DOC 20) -> ĐANG ACTIVE, SẴN SÀNG BẤM "TÁCH AO"!`);
  console.log(`• Kho vật tư : 22 sản phẩm, tồn kho dương 100%, sẵn sàng phục vụ báo cáo tài chính.`);
  console.log('========================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ LỖI TRONG QUÁ TRÌNH SEED DỮ LIỆU:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
