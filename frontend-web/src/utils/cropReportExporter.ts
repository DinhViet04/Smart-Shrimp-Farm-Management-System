/**
 * cropReportExporter.ts
 *
 * Tiện ích tạo và tải file Báo cáo Vụ nuôi chuyên nghiệp:
 * - Hỗ trợ cả Báo cáo Từng Ao và Báo cáo TOÀN VỤ (Tất cả các ao tham gia vụ nuôi)
 * 1. Excel (.xlsx) đa trang tính (Tổng quan vụ/toàn vụ, Chi phí, Cho ăn, Môi trường, Tăng trưởng, Thuốc/Vật tư, Sự cố)
 * 2. Word Docs (.docx) định dạng văn bản nghiệm thu, biểu bảng và chữ ký xác nhận chuẩn
 * 3. PDF (.pdf) trực quan, chuẩn in ấn A4, đầy đủ biểu đồ, KPI và nhận xét đánh giá
 */

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  ShadingType,
  BorderStyle,
} from 'docx';
import { jsPDF } from 'jspdf';
import { type CropDetailedReportResponse, type Crop } from '../services/crop.service';
import { type CropCycle } from './cropCycleGrouping';

// ── Helper: Format tiền tệ VND ──────────────────────────────────────────────
export const formatVND = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0 đ';
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))} đ`;
};

// ── Helper: Format số lượng ──────────────────────────────────────────────────
export const formatNumber = (num: number | null | undefined, digits: number = 0): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
};

// ── Helper: Format ngày tháng ────────────────────────────────────────────────
export const formatDateVi = (dateVal: string | number | Date | null | undefined): string => {
  if (!dateVal) return '--';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '--';
  }
};

// ── Helper: Chuyển tiếng Việt có dấu sang không dấu (dùng cho jsPDF Helvetica) ──
export const toAsciiVi = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

// ── Helper: Khử dấu tiếng Việt và ký tự cấm trên Windows để đặt tên file an toàn ──
export const sanitizeFileName = (name: string): string => {
  return toAsciiVi(name)
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

// ── Helper: Tải Blob về máy đảm bảo 100% hoạt động trên mọi trình duyệt ──────
export const downloadBlob = (blob: Blob, rawFilename: string, mimeType?: string) => {
  const parts = rawFilename.split('.');
  const ext = parts.pop() || '';
  const base = parts.join('.');
  const safeFilename = `${sanitizeFileName(base)}.${ext}`;

  const fileBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
  const url = URL.createObjectURL(fileBlob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.setAttribute('download', safeFilename);
  link.download = safeFilename;
  link.rel = 'noopener';
  document.body.appendChild(link);

  try {
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } catch {
    link.click();
  }

  // Giữ ObjectURL trong 60 giây để trình duyệt kịp dispatch tải xuống đĩa
  setTimeout(() => {
    try {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    } catch {
      // bỏ qua nếu DOM đã tự giải phóng
    }
  }, 60000);
};

// ── Helper: Tạo tên file chuẩn ───────────────────────────────────────────────
export const generateReportFileName = (
  crop: Crop | null,
  extension: 'xlsx' | 'docx' | 'pdf',
  cycle?: CropCycle | null,
  isFullCycle: boolean = false,
): string => {
  const rawCycleName = cycle?.name || 'VuNuoi';
  const rawPondName = isFullCycle ? 'TOAN_VU' : (crop?.pond?.name || 'Ao');
  const dateStr = formatDateVi(crop?.actualHarvestDate || crop?.startDate || cycle?.endDate || new Date()).replace(/\//g, '-');
  const baseName = `BaoCao_${rawCycleName}_${rawPondName}_${dateStr}`;
  return `${sanitizeFileName(baseName)}.${extension}`;
};

// ============================================================================
// 1. XUẤT FILE EXCEL (.XLSX) - HỖ TRỢ CẢ TỪNG AO VÀ TOÀN BỘ VỤ NUÔI
// ============================================================================
export const buildCropWorkbook = (
  report: CropDetailedReportResponse,
  cycle?: CropCycle | null,
): XLSX.WorkBook => {
  const { crop, doc, feeding, waterQuality, growth, health, treatmentsAndSupplies, incidents, financial } = report;
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Tổng quan vụ nuôi ──
  const overviewData = [
    ['HỆ THỐNG QUẢN LÝ TRANG TRẠI NUÔI TÔM THÔNG MINH - SSFM'],
    ['BÁO CÁO TỔNG KẾT & NGHIỆM THU VỤ NUÔI TÔM'],
    ['Ngày xuất báo cáo:', formatDateVi(new Date())],
    [],
    ['1. THÔNG TIN HÀNH CHÍNH VỤ NUÔI'],
    ['Tên vụ nuôi:', cycle?.name || `Vụ nuôi ao ${crop.pond?.name}`],
    ['Mã vụ:', cycle?.code || `CROP-${crop.id.slice(0, 8).toUpperCase()}`],
    ['Trang trại:', cycle?.farmName || crop.pond?.farm?.name || '--'],
    ['Ao nuôi:', crop.pond?.name || '--'],
    ['Diện tích ao (m2):', crop.pond?.areaSize || '--'],
    ['Độ sâu ao (m):', crop.pond?.depth || '--'],
    ['Mô hình nuôi:', cycle?.isHighTech ? 'Công nghệ cao 2 giai đoạn' : 'Thương phẩm truyền thống'],
    ['Ngày bắt đầu thả:', formatDateVi(crop.startDate)],
    ['Ngày thu hoạch:', formatDateVi(crop.actualHarvestDate || crop.expectedHarvestDate)],
    ['Thời gian nuôi thực tế (DOC):', `${doc} ngày`],
    ['Giống tôm thả:', crop.seedType || 'Tôm thẻ chân trắng'],
    ['Nguồn giống tham chiếu:', crop.seedSource || 'tepbac.com'],
    ['Số lượng giống thả (con):', crop.initialShrimpCount],
    ['Đơn giá con giống (đ/con):', crop.seedUnitPrice || 0],
    ['Tổng chi phí con giống (đ):', crop.harvestSeedCost ?? crop.seedCost ?? 0],
    [],
    ['2. KẾT QUẢ THU HOẠCH & CHỈ TIÊU KỸ THUẬT'],
    ['Chỉ tiêu', 'Thực tế đạt được', 'Mục tiêu kế hoạch', 'Đánh giá / Chênh lệch'],
    ['Sản lượng thu hoạch (kg)', financial.actualKg, (crop.initialShrimpCount * (crop.targetSurvivalRate || 80) / 100) / (crop.targetHarvestSize || 30), `${financial.actualKg > 0 ? formatNumber(financial.actualKg, 1) + ' kg' : 'Chưa có'}`],
    ['Kích cỡ tôm (con/kg)', financial.actualSize, crop.targetHarvestSize || '--', `${financial.actualSize > 0 ? financial.actualSize + ' con/kg' : '--'}`],
    ['Tỷ lệ sống (%)', financial.survivalRate !== null ? `${financial.survivalRate}%` : '--', crop.targetSurvivalRate ? `${crop.targetSurvivalRate}%` : '--', financial.survivalRate !== null && crop.targetSurvivalRate ? `${(financial.survivalRate - crop.targetSurvivalRate).toFixed(1)}%` : '--'],
    ['Hệ số thức ăn (FCR)', financial.fcr !== null ? financial.fcr : '--', '1.2 - 1.3', financial.fcr ? (financial.fcr <= 1.3 ? 'Tốt' : 'Cần tối ưu') : '--'],
    ['Tổng lượng thức ăn đã dùng (kg)', feeding.totalFeedKg, crop.targetTotalFeedKg || '--', `${formatNumber(feeding.totalFeedKg, 1)} kg`],
    ['Tổng số lần kiểm tra môi trường', waterQuality.totalMeasurements, '--', `${waterQuality.totalMeasurements} lượt`],
    ['Tổng số lần cảnh báo nước', waterQuality.alerts.total, '0', `${waterQuality.alerts.total} cảnh báo`],
    ['Tổng số lượng tôm hao hụt (con)', health.totalDeadShrimp, '--', `${health.totalDeadShrimp} con`],
    ['Tổng số sự cố phát sinh', incidents.total, '0', `${incidents.total} vụ (${incidents.resolved} đã giải quyết)`],
    [],
    ['3. TỔNG HỢP HIỆU QUẢ KINH TẾ (VND)'],
    ['Khoản mục', 'Số tiền (VNĐ)', 'Tỷ lệ trên doanh thu (%)'],
    ['Tổng doanh thu thu hoạch', financial.actualRevenue, '100%'],
    ['Tổng chi phí hoạt động', financial.costs.total, financial.actualRevenue > 0 ? `${((financial.costs.total / financial.actualRevenue) * 100).toFixed(1)}%` : '--'],
    ['LỢI NHUẬN RÒNG (LÃI / LỖ)', financial.profit, financial.actualRevenue > 0 ? `${((financial.profit / financial.actualRevenue) * 100).toFixed(1)}%` : '--'],
    [],
    ['4. ĐÁNH GIÁ CHUYÊN MÔN & BÀI HỌC KINH NGHIỆM TỪ HỆ THỐNG / AI'],
    ['Đánh giá tổng quan vụ nuôi:', crop.harvestEvaluation || 'Vụ nuôi vận hành ổn định, đã ghi nhận đầy đủ dữ liệu thu hoạch và các khoản chi phí liên quan.'],
    ['Bài học kinh nghiệm rút ra:', crop.harvestLessonsLearned || 'Kiểm soát chặt chẽ liều lượng thức ăn theo điều kiện thời tiết thực tế để giữ FCR ở mức tối ưu.'],
    ['Khuyến nghị cho vụ tiếp theo:', crop.harvestNextRecommendation || 'Tiếp tục áp dụng quy trình xử lý nước định kỳ và duy trì mật độ nuôi hợp lý cho ao.'],
    ['Ghi chú thu hoạch:', crop.harvestNote || 'Không có ghi chú thêm.'],
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Tong_Quan_Vu');

  // ── Sheet 2: Chi phí & Tài chính chi tiết ──
  const costRows = [
    ['BẢNG HẠCH TOÁN CHI PHÍ & TÀI CHÍNH VỤ NUÔI'],
    ['Ao nuôi:', crop.pond?.name || '--', 'Ngày kết toán:', formatDateVi(crop.actualHarvestDate || new Date())],
    [],
    ['STT', 'Hạng mục chi phí', 'Thành tiền (VNĐ)', 'Tỷ trọng chi phí (%)', 'Ghi chú'],
    [1, 'Chi phí con giống ban đầu', financial.costs.seed, financial.costs.total > 0 ? `${((financial.costs.seed / financial.costs.total) * 100).toFixed(1)}%` : '0%', `${crop.initialShrimpCount} con @ ${formatVND(crop.seedUnitPrice)}`],
    [2, 'Chi phí thức ăn nuôi tôm', financial.costs.feed, financial.costs.total > 0 ? `${((financial.costs.feed / financial.costs.total) * 100).toFixed(1)}%` : '0%', `Tổng ${formatNumber(feeding.totalFeedKg, 1)} kg`],
    [3, 'Chi phí thuốc thú y & men vi sinh', financial.costs.medicine, financial.costs.total > 0 ? `${((financial.costs.medicine / financial.costs.total) * 100).toFixed(1)}%` : '0%', 'Phòng ngừa & điều trị'],
    [4, 'Chi phí hóa chất & xử lý nước', financial.costs.chemical, financial.costs.total > 0 ? `${((financial.costs.chemical / financial.costs.total) * 100).toFixed(1)}%` : '0%', 'Cải tạo ao & ổn định kiềm'],
    [5, 'Chi phí điện năng & dầu máy', financial.costs.electricity, financial.costs.total > 0 ? `${((financial.costs.electricity / financial.costs.total) * 100).toFixed(1)}%` : '0%', 'Quạt nước & sục khí oxy'],
    [6, 'Chi phí nhân công chăm sóc', financial.costs.labor, financial.costs.total > 0 ? `${((financial.costs.labor / financial.costs.total) * 100).toFixed(1)}%` : '0%', 'Vận hành ao & cho ăn'],
    [7, 'Chi phí vận hành khác', financial.costs.other, financial.costs.total > 0 ? `${((financial.costs.other / financial.costs.total) * 100).toFixed(1)}%` : '0%', 'Khấu hao, dụng cụ, kiểm nghiệm'],
    [],
    ['', 'TỔNG CỘNG CHI PHÍ HOẠT ĐỘNG', financial.costs.total, '100.0%', ''],
    ['', 'TỔNG DOANH THU BÁN TÔM', financial.actualRevenue, '', `Giá bán bình quân: ${formatVND(crop.actualHarvestPricePerKg)}/kg`],
    ['', 'LỢI NHUẬN RÒNG (LÃI / LỖ)', financial.profit, '', financial.profit >= 0 ? 'Có lãi' : 'Bị lỗ'],
  ];

  const wsCost = XLSX.utils.aoa_to_sheet(costRows);
  wsCost['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 22 }, { wch: 22 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsCost, 'Chi_Phi_Tai_Chinh');

  // ── Sheet 3: Nhật ký cho ăn ──
  const feedHeader = [
    ['NHẬT KÝ CHI TIẾT CÁC CỮ CHO ĂN TRONG VỤ NUÔI'],
    ['Ao:', crop.pond?.name, 'Tổng lượng thức ăn đã cấp:', `${formatNumber(feeding.totalFeedKg, 1)} kg`],
    [],
    ['STT', 'Ngày cho ăn', 'Cữ ăn trong ngày', 'Tên sản phẩm thức ăn', 'Lượng cho ăn (kg)', 'Đơn giá (đ/kg)', 'Thành tiền (đ)', 'Trạng thái cữ', 'Người phụ trách', 'Ghi chú'],
  ];

  const feedRows = (feeding.recentLogs || []).map((log, index) => [
    index + 1,
    formatDateVi(log.feedingDate),
    `Cữ ${log.feedingSession || index + 1}`,
    log.feedProduct?.itemName || 'Thức ăn chuẩn',
    Number(log.feedAmount) || 0,
    log.feedProduct?.pricePerPackage ? Math.round(Number(log.feedProduct.pricePerPackage) / (Number(log.feedProduct.weightPerPkg) || 1)) : 0,
    log.feedProduct?.pricePerPackage ? Math.round((Number(log.feedAmount) || 0) * (Number(log.feedProduct.pricePerPackage) / (Number(log.feedProduct.weightPerPkg) || 1))) : 0,
    log.feedingStatus === 'COMPLETED' ? 'Đã cho ăn' : log.feedingStatus === 'SKIPPED' ? 'Bỏ cữ' : 'Cho ăn chậm',
    log.creator?.fullName || 'Kỹ thuật viên',
    log.note || '',
  ]);

  const wsFeed = XLSX.utils.aoa_to_sheet([...feedHeader, ...feedRows]);
  wsFeed['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsFeed, 'Nhat_Ky_Cho_An');

  // ── Sheet 4: Môi trường nước ──
  const waterHeader = [
    ['NHẬT KÝ GIÁM SÁT MÔI TRƯỜNG NƯỚC AO NUÔI'],
    ['Ao:', crop.pond?.name, 'Tổng số lượt đo:', waterQuality.totalMeasurements],
    [],
    ['STT', 'Thời gian đo', 'pH', 'Oxy DO (mg/L)', 'Độ mặn (‰)', 'Nhiệt độ (°C)', 'Độ kiềm (mg/L)', 'NH3 (mg/L)', 'NO2 (mg/L)', 'Đánh giá an toàn', 'Người đo'],
  ];

  const waterRows = (waterQuality.recentRecords || []).map((w, index) => {
    const isPhAlert = Number(w.ph) < 7.5 || Number(w.ph) > 8.5;
    const isDoAlert = Number(w.dissolvedOxygen) < 4.0;
    const isNh3Alert = Number(w.nh3) > 0.1;
    const isNo2Alert = Number(w.no2) > 0.2;
    const hasAlert = isPhAlert || isDoAlert || isNh3Alert || isNo2Alert;

    return [
      index + 1,
      formatDateVi(w.recordTime),
      Number(w.ph) || '--',
      Number(w.dissolvedOxygen) || '--',
      Number(w.salinity) || '--',
      Number(w.temperature) || '--',
      Number(w.alkalinity) || '--',
      Number(w.nh3) || '--',
      Number(w.no2) || '--',
      hasAlert ? 'Cảnh báo chỉ số' : 'Ổn định',
      w.creator?.fullName || 'Kỹ thuật viên',
    ];
  });

  const wsWater = XLSX.utils.aoa_to_sheet([...waterHeader, ...waterRows]);
  wsWater['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsWater, 'Moi_Truong_Nuoc');

  // ── Sheet 5: Tăng trưởng & Mẫu kích cỡ ──
  const growthHeader = [
    ['LỊCH SỬ LẤY MẪU TĂNG TRƯỞNG & ƯỚC TÍNH SINH KHỐI'],
    ['Ao:', crop.pond?.name, 'Tổng số đợt chài mẫu:', growth.totalSamples],
    [],
    ['STT', 'Ngày lấy mẫu', 'Ngày tuổi (DOC)', 'Trọng lượng ABW (g/con)', 'Tăng trưởng ADG (g/ngày)', 'Kích cỡ (con/kg)', 'Sinh khối ước tính (kg)', 'Ghi chú'],
  ];

  const growthRows = (growth.samples || []).map((g, index) => [
    index + 1,
    formatDateVi(g.samplingDate),
    g.doc || '--',
    Number(g.abwGram) || '--',
    g.adgGramPerDay ? Number(g.adgGramPerDay) : '--',
    Number(g.sizePerKg) || '--',
    g.estimatedBiomassKg ? Number(g.estimatedBiomassKg) : '--',
    g.notes || '',
  ]);

  const wsGrowth = XLSX.utils.aoa_to_sheet([...growthHeader, ...growthRows]);
  wsGrowth['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsGrowth, 'Tang_Truong_Sinh_Khoi');

  // ── Sheet 6: Vật tư & Thuốc sử dụng ──
  const medHeader = [
    ['NHẬT KÝ XUẤT DÙNG THUỐC, MEN VI SINH & HÓA CHẤT XỬ LÝ'],
    ['Tổng chi phí vật tư & thuốc:', formatVND(treatmentsAndSupplies.totalTreatmentCost)],
    [],
    ['STT', 'Ngày xuất dùng', 'Danh mục', 'Tên sản phẩm / Vật tư', 'Số lượng', 'Đơn vị', 'Đơn giá (đ)', 'Thành tiền (đ)', 'Mục đích sử dụng', 'Người thực hiện'],
  ];

  const medRows = (treatmentsAndSupplies.items || []).map((item, index) => [
    index + 1,
    formatDateVi(item.usageDate),
    item.category === 'MEDICINE' ? 'Thuốc thú y' : item.category === 'CHEMICAL' ? 'Hóa chất / Men' : 'Vật tư khác',
    item.itemName,
    item.quantityUsed,
    item.unit,
    item.unitPrice,
    item.totalCost,
    item.notes || 'Sử dụng định kỳ',
    item.creatorName || 'Kỹ thuật viên',
  ]);

  const wsMed = XLSX.utils.aoa_to_sheet([...medHeader, ...medRows]);
  wsMed['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsMed, 'Vat_Tu_Thuoc_Dung');

  // ── Sheet 7: Sự cố & Biện pháp xử lý ──
  const incHeader = [
    ['NHẬT KÝ SỰ CỐ & BIỆN PHÁP ĐIỀU TRỊ TRONG VỤ'],
    ['Tổng số sự cố:', incidents.total, 'Đã giải quyết hoàn toàn:', incidents.resolved],
    [],
    ['STT', 'Ngày phát hiện', 'Tiêu đề sự cố', 'Trạng thái', 'Mô tả chi tiết', 'Biện pháp điều trị', 'Người báo cáo', 'Người phụ trách xử lý'],
  ];

  const incRows = (incidents.list || []).map((inc, index) => [
    index + 1,
    formatDateVi(inc.createdAt),
    inc.title,
    inc.status === 'RESOLVED' ? 'Đã xử lý xong' : 'Đang xử lý',
    inc.description || '',
    inc.treatment || '',
    inc.reporter?.fullName || '--',
    inc.assignedTo?.fullName || '--',
  ]);

  const wsInc = XLSX.utils.aoa_to_sheet([...incHeader, ...incRows]);
  wsInc['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 35 }, { wch: 35 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsInc, 'Su_Co_Dich_Benh');

  return wb;
};

export const exportCropToExcel = (
  report: CropDetailedReportResponse,
  cycle?: CropCycle | null,
) => {
  const wb = buildCropWorkbook(report, cycle);
  const fileName = generateReportFileName(report.crop, 'xlsx', cycle);
  XLSX.writeFile(wb, fileName);
};

// ============================================================================
// 1B. XUẤT FILE EXCEL (.XLSX) TOÀN VỤ - TỔNG HỢP TẤT CẢ CÁC AO TRONG VỤ
// ============================================================================
export const exportCycleToExcel = (
  cycle: CropCycle,
  reports: CropDetailedReportResponse[],
) => {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Tổng quan toàn bộ vụ nuôi & Bảng so sánh các ao ──
  const overviewData: any[][] = [
    ['HỆ THỐNG QUẢN LÝ TRANG TRẠI NUÔI TÔM THÔNG MINH - SSFM'],
    ['BÁO CÁO TỔNG KẾT TOÀN VỤ NUÔI (TẤT CẢ CÁC AO)'],
    ['Ngày xuất báo cáo:', formatDateVi(new Date())],
    [],
    ['1. THÔNG TIN CHUNG TOÀN VỤ'],
    ['Tên vụ nuôi:', cycle.name],
    ['Mã vụ:', cycle.code],
    ['Trang trại:', cycle.farmName],
    ['Mô hình nuôi:', cycle.isHighTech ? 'Công nghệ cao 2 giai đoạn (Ương ➔ Nuôi)' : 'Thương phẩm truyền thống'],
    ['Tổng số ao tham gia vụ:', `${cycle.totals.totalPondsCount} ao`],
    ['Thời gian chu kỳ vụ:', `${formatDateVi(cycle.startDate)} ➔ ${formatDateVi(cycle.endDate)} (${cycle.durationDays} ngày)`],
    ['Tổng lượng con giống thả ban đầu:', `${formatNumber(cycle.totals.totalStockedShrimp)} con`],
    ['Tổng sản lượng thu hoạch toàn vụ:', `${formatNumber(cycle.totals.totalHarvestKg, 1)} kg (~${cycle.totals.totalHarvestTons} tấn)`],
    ['Tỷ lệ sống bình quân toàn vụ (SR):', cycle.totals.overallSurvivalRate !== null ? `${cycle.totals.overallSurvivalRate}%` : '--'],
    ['Hệ số thức ăn bình quân toàn vụ (FCR):', cycle.totals.avgFcr !== null ? cycle.totals.avgFcr : '--'],
    ['Tổng doanh thu thu hoạch toàn vụ:', cycle.totals.totalRevenue],
    ['Tổng chi phí hoạt động toàn vụ:', cycle.totals.totalCost],
    ['TỔNG LỢI NHUẬN RÒNG TOÀN VỤ:', cycle.totals.totalProfit],
    ['Biên lợi nhuận toàn vụ:', cycle.totals.totalRevenue > 0 ? `${((cycle.totals.totalProfit / cycle.totals.totalRevenue) * 100).toFixed(1)}%` : '--'],
    [],
    ['2. BẢNG TỔNG HỢP & SO SÁNH HIỆU QUẢ TỪNG AO TRONG VỤ NUÔI'],
    [
      'STT',
      'Tên ao nuôi',
      'Vai trò / Giai đoạn',
      'Diện tích (m²)',
      'Số giống thả (con)',
      'Ngày thả giống',
      'Ngày thu / Tách',
      'Sản lượng (kg)',
      'Cỡ tôm (con/kg)',
      'Tỷ lệ sống (%)',
      'FCR',
      'Doanh thu (VNĐ)',
      'Tổng chi phí (VNĐ)',
      'Lợi nhuận ròng (VNĐ)',
      'Trạng thái',
    ],
  ];

  // Thêm từng ao vào bảng
  cycle.allCrops.forEach((c, idx) => {
    const r = reports.find((item) => item.crop.id === c.id);
    const harvestKg = r?.financial.actualKg ?? c.actualHarvestKg ?? 0;
    const harvestSize = r?.financial.actualSize ?? c.actualHarvestSize ?? '--';
    const sr = r?.financial.survivalRate ?? c.actualHarvestSurvivalRate ?? '--';
    const fcr = r?.financial.fcr ?? c.actualHarvestFcr ?? '--';
    const rev = r?.financial.actualRevenue ?? c.actualHarvestRevenue ?? 0;
    const cost = r?.financial.costs.total ?? c.actualHarvestCost ?? 0;
    const profit = r?.financial.profit ?? c.actualHarvestProfit ?? 0;

    overviewData.push([
      idx + 1,
      c.pond?.name || `Ao ${idx + 1}`,
      c.stage === 'NURSERY' ? 'Ao Ương (GĐ 1)' : 'Thương phẩm (GĐ 2)',
      c.pond?.areaSize || '--',
      c.initialShrimpCount,
      formatDateVi(c.startDate),
      formatDateVi(c.actualHarvestDate || c.transferDate || c.expectedHarvestDate),
      harvestKg,
      harvestSize,
      sr !== '--' ? `${sr}%` : '--',
      fcr,
      rev,
      cost,
      profit,
      c.status === 'HARVESTED' ? 'Đã thu hoạch' : 'Đang nuôi',
    ]);
  });

  // Hàng tổng cộng toàn vụ
  overviewData.push([
    '',
    'TỔNG CỘNG / BÌNH QUÂN TOÀN VỤ',
    `${cycle.totals.totalPondsCount} ao`,
    '',
    cycle.totals.totalStockedShrimp,
    formatDateVi(cycle.startDate),
    formatDateVi(cycle.endDate),
    cycle.totals.totalHarvestKg,
    cycle.totals.avgHarvestSize || '--',
    cycle.totals.overallSurvivalRate !== null ? `${cycle.totals.overallSurvivalRate}%` : '--',
    cycle.totals.avgFcr || '--',
    cycle.totals.totalRevenue,
    cycle.totals.totalCost,
    cycle.totals.totalProfit,
    cycle.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Đang nuôi',
  ]);

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 10 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Tong_Quan_Toan_Vu');

  // ── Sheet 2: Chi tiết tài chính từng ao & Toàn vụ ──
  const costSheetRows: any[][] = [
    ['BẢNG HẠCH TOÁN CHI PHÍ TỪNG AO & TOÀN VỤ'],
    ['Vụ:', cycle.name, 'Trang trại:', cycle.farmName],
    [],
    [
      'Hạng mục chi phí',
      ...cycle.allCrops.map((c) => c.pond?.name || 'Ao'),
      'TỔNG CỘNG TOÀN VỤ',
      'Tỷ trọng toàn vụ (%)',
    ],
  ];

  const categories = [
    { key: 'seed', label: '1. Chi phí con giống ban đầu' },
    { key: 'feed', label: '2. Chi phí thức ăn nuôi tôm' },
    { key: 'medicine', label: '3. Chi phí thuốc thú y & men vi sinh' },
    { key: 'chemical', label: '4. Chi phí hóa chất cải tạo & xử lý nước' },
    { key: 'electricity', label: '5. Chi phí điện & nhiên liệu' },
    { key: 'labor', label: '6. Chi phí nhân công chăm sóc' },
    { key: 'other', label: '7. Chi phí khác' },
  ];

  categories.forEach((cat) => {
    let rowTotal = 0;
    const pondCosts = cycle.allCrops.map((c) => {
      const r = reports.find((item) => item.crop.id === c.id);
      const val = (r?.financial.costs as any)?.[cat.key] || 0;
      rowTotal += val;
      return val;
    });

    costSheetRows.push([
      cat.label,
      ...pondCosts,
      rowTotal,
      cycle.totals.totalCost > 0 ? `${((rowTotal / cycle.totals.totalCost) * 100).toFixed(1)}%` : '--',
    ]);
  });

  // Hàng tổng chi phí
  costSheetRows.push([
    'TỔNG CHI PHÍ HOẠT ĐỘNG',
    ...cycle.allCrops.map((c) => {
      const r = reports.find((item) => item.crop.id === c.id);
      return r?.financial.costs.total || c.actualHarvestCost || 0;
    }),
    cycle.totals.totalCost,
    '100.0%',
  ]);

  // Hàng doanh thu
  costSheetRows.push([
    'TỔNG DOANH THU BÁN TÔM',
    ...cycle.allCrops.map((c) => {
      const r = reports.find((item) => item.crop.id === c.id);
      return r?.financial.actualRevenue || c.actualHarvestRevenue || 0;
    }),
    cycle.totals.totalRevenue,
    '',
  ]);

  // Hàng lợi nhuận
  costSheetRows.push([
    'LỢI NHUẬN RÒNG (LÃI / LỖ)',
    ...cycle.allCrops.map((c) => {
      const r = reports.find((item) => item.crop.id === c.id);
      return r?.financial.profit ?? c.actualHarvestProfit ?? 0;
    }),
    cycle.totals.totalProfit,
    '',
  ]);

  const wsCost = XLSX.utils.aoa_to_sheet(costSheetRows);
  XLSX.utils.book_append_sheet(wb, wsCost, 'Chi_Phi_Cac_Ao');

  // ── Sheet 3: Nhật ký cho ăn của tất cả các ao ──
  const feedHeader = [
    ['TỔNG HỢP NHẬT KÝ CHO ĂN CÁC AO TRONG VỤ'],
    [],
    ['STT', 'Ao nuôi', 'Ngày cho ăn', 'Cữ ăn', 'Tên thức ăn', 'Lượng cấp (kg)', 'Đơn giá (đ/kg)', 'Thành tiền (đ)', 'Trạng thái cữ', 'Người phụ trách', 'Ghi chú'],
  ];

  let feedIdx = 1;
  const allFeedingRows: any[][] = [];
  reports.forEach((r) => {
    (r.feeding.recentLogs || []).forEach((log) => {
      allFeedingRows.push([
        feedIdx++,
        r.crop.pond?.name || 'Ao',
        formatDateVi(log.feedingDate),
        `Cữ ${log.feedingSession || 1}`,
        log.feedProduct?.itemName || 'Thức ăn chuẩn',
        Number(log.feedAmount) || 0,
        log.feedProduct?.pricePerPackage ? Math.round(Number(log.feedProduct.pricePerPackage) / (Number(log.feedProduct.weightPerPkg) || 1)) : 0,
        log.feedProduct?.pricePerPackage ? Math.round((Number(log.feedAmount) || 0) * (Number(log.feedProduct.pricePerPackage) / (Number(log.feedProduct.weightPerPkg) || 1))) : 0,
        log.feedingStatus === 'COMPLETED' ? 'Đã cho ăn' : log.feedingStatus === 'SKIPPED' ? 'Bỏ cữ' : 'Cho ăn chậm',
        log.creator?.fullName || 'Kỹ thuật viên',
        log.note || '',
      ]);
    });
  });

  const wsFeed = XLSX.utils.aoa_to_sheet([...feedHeader, ...allFeedingRows]);
  XLSX.utils.book_append_sheet(wb, wsFeed, 'Nhat_Ky_Cho_An_Cac_Ao');

  // ── Sheet 4: Môi trường nước của tất cả các ao ──
  const waterHeader = [
    ['TỔNG HỢP ĐO MÔI TRƯỜNG NƯỚC CÁC AO TRONG VỤ'],
    [],
    ['STT', 'Ao nuôi', 'Thời gian đo', 'pH', 'DO (mg/L)', 'Độ mặn (‰)', 'Nhiệt độ (°C)', 'Độ kiềm (mg/L)', 'NH3 (mg/L)', 'NO2 (mg/L)', 'Đánh giá', 'Người đo'],
  ];

  let waterIdx = 1;
  const allWaterRows: any[][] = [];
  reports.forEach((r) => {
    (r.waterQuality.recentRecords || []).forEach((w) => {
      const isAlert = Number(w.ph) < 7.5 || Number(w.ph) > 8.5 || Number(w.dissolvedOxygen) < 4.0 || Number(w.nh3) > 0.1 || Number(w.no2) > 0.2;
      allWaterRows.push([
        waterIdx++,
        r.crop.pond?.name || 'Ao',
        formatDateVi(w.recordTime),
        Number(w.ph) || '--',
        Number(w.dissolvedOxygen) || '--',
        Number(w.salinity) || '--',
        Number(w.temperature) || '--',
        Number(w.alkalinity) || '--',
        Number(w.nh3) || '--',
        Number(w.no2) || '--',
        isAlert ? 'Cảnh báo chỉ số' : 'Ổn định',
        w.creator?.fullName || 'Kỹ thuật viên',
      ]);
    });
  });

  const wsWater = XLSX.utils.aoa_to_sheet([...waterHeader, ...allWaterRows]);
  XLSX.utils.book_append_sheet(wb, wsWater, 'Moi_Truong_Cac_Ao');

  // ── Sheet 5: Vật tư & Thuốc của tất cả các ao ──
  const medHeader = [
    ['TỔNG HỢP VẬT TƯ & THUỐC ĐÃ XUẤT CHO CÁC AO TRONG VỤ'],
    [],
    ['STT', 'Ao sử dụng', 'Ngày xuất dùng', 'Danh mục', 'Tên sản phẩm', 'Số lượng', 'Đơn vị', 'Đơn giá (đ)', 'Thành tiền (đ)', 'Mục đích sử dụng', 'Người thực hiện'],
  ];

  let medIdx = 1;
  const allMedRows: any[][] = [];
  reports.forEach((r) => {
    (r.treatmentsAndSupplies.items || []).forEach((item) => {
      allMedRows.push([
        medIdx++,
        r.crop.pond?.name || 'Ao',
        formatDateVi(item.usageDate),
        item.category === 'MEDICINE' ? 'Thuốc thú y' : item.category === 'CHEMICAL' ? 'Hóa chất / Men' : 'Khác',
        item.itemName,
        item.quantityUsed,
        item.unit,
        item.unitPrice,
        item.totalCost,
        item.notes || '',
        item.creatorName || '',
      ]);
    });
  });

  const wsMed = XLSX.utils.aoa_to_sheet([...medHeader, ...allMedRows]);
  XLSX.utils.book_append_sheet(wb, wsMed, 'Vat_Tu_Thuoc_Cac_Ao');

  // Tải file Excel Toàn Vụ
  const fileName = generateReportFileName(null, 'xlsx', cycle, true);
  XLSX.writeFile(wb, fileName);
};

// ============================================================================
// 2. XUẤT FILE WORD DOCS (.DOCX) - TỪNG AO
// ============================================================================
export const buildCropDocxDocument = (
  report: CropDetailedReportResponse,
  cycle?: CropCycle | null,
): Document => {
  const { crop, doc, feeding, financial } = report;

  const farmName = cycle?.farmName || crop.pond?.farm?.name || 'Trang trại Thủy sản Thông minh';
  const pondName = crop.pond?.name || 'Ao nuôi';
  const cycleTitle = cycle?.name || `Vụ nuôi ${pondName}`;
  const cycleCode = cycle?.code || `VU-${crop.id.slice(0, 6).toUpperCase()}`;

  const createCell = (
    text: string,
    isBold: boolean = false,
    isHeader: boolean = false,
    alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  ) => {
    return new TableCell({
      shading: isHeader ? { type: ShadingType.CLEAR, fill: '1E3A8A' } : undefined,
      children: [
        new Paragraph({
          alignment,
          children: [
            new TextRun({
              text,
              bold: isBold,
              color: isHeader ? 'FFFFFF' : '1E293B',
              size: isHeader ? 21 : 20,
              font: 'Calibri',
            }),
          ],
        }),
      ],
    });
  };

  const docx = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 24, font: 'Calibri' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, size: 22, font: 'Calibri', color: '334155' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '----------------o0o----------------', color: '64748B', size: 18 })],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'BÁO CÁO TỔNG KẾT & NGHIỆM THU VỤ NUÔI TÔM', bold: true, size: 30, color: '1E40AF', font: 'Calibri' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Hệ thống SSFM • ${farmName} • Ao ${pondName}`, italics: true, size: 20, color: '475569' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Ngày lập: ${formatDateVi(new Date())}`, italics: true, size: 19, color: '64748B' })],
          }),
          new Paragraph({ text: '' }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'I. THÔNG TIN HÀNH CHÍNH & VẬN HÀNH', bold: true, size: 24, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Tên vụ nuôi:', true),
                  createCell(`${cycleTitle} (${cycleCode})`),
                  createCell('Ao nuôi thực hiện:', true),
                  createCell(`${pondName} (${crop.pond?.areaSize || '--'} m²)`),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Mô hình nuôi:', true),
                  createCell(cycle?.isHighTech ? 'Công nghệ cao 2 giai đoạn' : 'Thương phẩm'),
                  createCell('Thời gian nuôi (DOC):', true),
                  createCell(`${doc} ngày (${formatDateVi(crop.startDate)} ➔ ${formatDateVi(crop.actualHarvestDate || crop.expectedHarvestDate)})`),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Giống tôm thả:', true),
                  createCell(crop.seedType || 'Tôm thẻ chân trắng'),
                  createCell('Số lượng giống thả:', true),
                  createCell(`${formatNumber(crop.initialShrimpCount)} con`),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Đơn giá con giống:', true),
                  createCell(formatVND(crop.seedUnitPrice)),
                  createCell('Tổng chi phí con giống:', true),
                  createCell(formatVND(crop.harvestSeedCost ?? crop.seedCost)),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '' }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'II. KẾT QUẢ THU HOẠCH & CHỈ TIÊU KỸ THUẬT', bold: true, size: 24, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Chỉ tiêu kỹ thuật', true, true),
                  createCell('Thực tế thu hoạch', true, true),
                  createCell('Mục tiêu kế hoạch', true, true),
                  createCell('Đánh giá thực hiện', true, true),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Tổng sản lượng thu hoạch', true),
                  createCell(`${formatNumber(financial.actualKg, 1)} kg (${(financial.actualKg / 1000).toFixed(2)} tấn)`),
                  createCell(crop.targetHarvestSize && crop.targetSurvivalRate ? `${formatNumber(((crop.initialShrimpCount * crop.targetSurvivalRate) / 100) / crop.targetHarvestSize, 0)} kg` : '--'),
                  createCell(financial.actualKg > 0 ? 'Đã thu hoạch' : 'Đang nuôi'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Kích cỡ tôm bình quân', true),
                  createCell(`${financial.actualSize || '--'} con/kg`),
                  createCell(`${crop.targetHarvestSize || '--'} con/kg`),
                  createCell(financial.actualSize ? (financial.actualSize <= (crop.targetHarvestSize || 30) ? 'Đạt mục tiêu' : 'Chưa đạt cỡ') : '--'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Tỷ lệ sống toàn vụ (SR)', true),
                  createCell(`${financial.survivalRate || '--'}%`),
                  createCell(`${crop.targetSurvivalRate || '--'}%`),
                  createCell(financial.survivalRate ? (financial.survivalRate >= (crop.targetSurvivalRate || 80) ? 'Đạt kế hoạch' : 'Hụt so với mục tiêu') : '--'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Hệ số thức ăn (FCR)', true),
                  createCell(`${financial.fcr || '--'}`),
                  createCell('1.20 - 1.30'),
                  createCell(financial.fcr ? (financial.fcr <= 1.3 ? 'Tối ưu' : 'Cần rà soát') : '--'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Tổng lượng thức ăn đã cấp', true),
                  createCell(`${formatNumber(feeding.totalFeedKg, 1)} kg`),
                  createCell(`${formatNumber(crop.targetTotalFeedKg, 1)} kg`),
                  createCell(`${feeding.completedSessions} cữ hoàn thành`),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '' }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'III. HẠCH TOÁN CHI PHÍ & TÀI CHÍNH', bold: true, size: 24, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Hạng mục tài chính', true, true),
                  createCell('Số tiền (VNĐ)', true, true, AlignmentType.RIGHT),
                  createCell('Tỷ trọng / Chi tiết', true, true),
                ],
              }),
              new TableRow({ children: [createCell('1. Chi phí con giống'), createCell(formatVND(financial.costs.seed), false, false, AlignmentType.RIGHT), createCell(`${((financial.costs.seed / Math.max(1, financial.costs.total)) * 100).toFixed(1)}%`)] }),
              new TableRow({ children: [createCell('2. Chi phí thức ăn'), createCell(formatVND(financial.costs.feed), false, false, AlignmentType.RIGHT), createCell(`${((financial.costs.feed / Math.max(1, financial.costs.total)) * 100).toFixed(1)}%`)] }),
              new TableRow({ children: [createCell('3. Chi phí thuốc & men vi sinh'), createCell(formatVND(financial.costs.medicine), false, false, AlignmentType.RIGHT), createCell(`${((financial.costs.medicine / Math.max(1, financial.costs.total)) * 100).toFixed(1)}%`)] }),
              new TableRow({ children: [createCell('4. Chi phí hóa chất xử lý nước'), createCell(formatVND(financial.costs.chemical), false, false, AlignmentType.RIGHT), createCell(`${((financial.costs.chemical / Math.max(1, financial.costs.total)) * 100).toFixed(1)}%`)] }),
              new TableRow({ children: [createCell('5. Chi phí điện & dầu máy'), createCell(formatVND(financial.costs.electricity), false, false, AlignmentType.RIGHT), createCell(`${((financial.costs.electricity / Math.max(1, financial.costs.total)) * 100).toFixed(1)}%`)] }),
              new TableRow({ children: [createCell('6. Chi phí nhân công'), createCell(formatVND(financial.costs.labor), false, false, AlignmentType.RIGHT), createCell(`${((financial.costs.labor / Math.max(1, financial.costs.total)) * 100).toFixed(1)}%`)] }),
              new TableRow({ children: [createCell('7. Chi phí khác'), createCell(formatVND(financial.costs.other), false, false, AlignmentType.RIGHT), createCell(`${((financial.costs.other / Math.max(1, financial.costs.total)) * 100).toFixed(1)}%`)] }),
              new TableRow({ children: [createCell('TỔNG CHI PHÍ VỤ NUÔI', true), createCell(formatVND(financial.costs.total), true, false, AlignmentType.RIGHT), createCell('100.0%', true)] }),
              new TableRow({ children: [createCell('TỔNG DOANH THU BÁN TÔM', true), createCell(formatVND(financial.actualRevenue), true, false, AlignmentType.RIGHT), createCell(`Đơn giá: ${formatVND(crop.actualHarvestPricePerKg)}/kg`, true)] }),
              new TableRow({ children: [createCell('LỢI NHUẬN RÒNG (LÃI / LỖ)', true), createCell(formatVND(financial.profit), true, false, AlignmentType.RIGHT), createCell(financial.profit >= 0 ? 'Có lãi' : 'Bị lỗ', true)] }),
            ],
          }),
          new Paragraph({ text: '' }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'IV. ĐÁNH GIÁ CHUYÊN MÔN & KHUYẾN NGHỊ TỪ HỆ THỐNG / AI', bold: true, size: 24, color: '1E3A8A' })],
          }),
          new Paragraph({ children: [new TextRun({ text: '1. Đánh giá tổng quan vụ: ', bold: true, color: '1E40AF' }), new TextRun({ text: crop.harvestEvaluation || 'Vụ nuôi hoàn thành theo kế hoạch, kiểm soát tốt chỉ số kỹ thuật và tài chính.' })] }),
          new Paragraph({ children: [new TextRun({ text: '2. Bài học kinh nghiệm: ', bold: true, color: '1E40AF' }), new TextRun({ text: crop.harvestLessonsLearned || 'Theo dõi chặt chẽ khí độc và điều chỉnh cữ thức ăn theo thời tiết.' })] }),
          new Paragraph({ children: [new TextRun({ text: '3. Khuyến nghị vụ sau: ', bold: true, color: '1E40AF' }), new TextRun({ text: crop.harvestNextRecommendation || 'Duy trì quy trình chăm sóc chuẩn và tăng cường sục khí ban đêm.' })] }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'KỸ THUẬT VIÊN PHỤ TRÁCH', bold: true, size: 21 })] }), new Paragraph({ text: '' }), new Paragraph({ text: '' }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '................................................', color: '94A3B8' })] })] }),
                  new TableCell({ borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'QUẢN LÝ TRANG TRẠI', bold: true, size: 21 })] }), new Paragraph({ text: '' }), new Paragraph({ text: '' }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '................................................', color: '94A3B8' })] })] }),
                  new TableCell({ borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CHỦ TRANG TRẠI / GIÁM ĐỐC', bold: true, size: 21 })] }), new Paragraph({ text: '' }), new Paragraph({ text: '' }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '................................................', color: '94A3B8' })] })] }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return docx;
};

export const exportCropToDocx = async (
  report: CropDetailedReportResponse,
  cycle?: CropCycle | null,
) => {
  const docx = buildCropDocxDocument(report, cycle);
  const blob = await Packer.toBlob(docx);
  const fileName = generateReportFileName(report.crop, 'docx', cycle);
  downloadBlob(blob, fileName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
};

// ============================================================================
// 2B. XUẤT FILE WORD DOCS (.DOCX) TOÀN VỤ - TỔNG HỢP TẤT CẢ CÁC AO
// ============================================================================
export const exportCycleToDocx = async (
  cycle: CropCycle,
  reports: CropDetailedReportResponse[],
) => {
  const farmName = cycle.farmName;
  const cycleTitle = cycle.name;
  const cycleCode = cycle.code;

  const createCell = (
    text: string,
    isBold: boolean = false,
    isHeader: boolean = false,
    alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  ) => {
    return new TableCell({
      shading: isHeader ? { type: ShadingType.CLEAR, fill: '1E3A8A' } : undefined,
      children: [
        new Paragraph({
          alignment,
          children: [
            new TextRun({
              text,
              bold: isBold,
              color: isHeader ? 'FFFFFF' : '1E293B',
              size: isHeader ? 20 : 19,
              font: 'Calibri',
            }),
          ],
        }),
      ],
    });
  };

  // Tạo các hàng so sánh từng ao
  const pondComparisonRows = [
    new TableRow({
      children: [
        createCell('Ao nuôi', true, true),
        createCell('Vai trò', true, true),
        createCell('Diện tích', true, true),
        createCell('Giống thả', true, true),
        createCell('DOC', true, true),
        createCell('Sản lượng (kg)', true, true),
        createCell('Cỡ tôm', true, true),
        createCell('Tỷ lệ sống', true, true),
        createCell('FCR', true, true),
        createCell('Lợi nhuận (đ)', true, true, AlignmentType.RIGHT),
      ],
    }),
  ];

  cycle.allCrops.forEach((c) => {
    const r = reports.find((item) => item.crop.id === c.id);
    const kg = r?.financial.actualKg ?? c.actualHarvestKg ?? 0;
    const size = r?.financial.actualSize ?? c.actualHarvestSize ?? '--';
    const sr = r?.financial.survivalRate ?? c.actualHarvestSurvivalRate ?? '--';
    const fcr = r?.financial.fcr ?? c.actualHarvestFcr ?? '--';
    const profit = r?.financial.profit ?? c.actualHarvestProfit ?? 0;

    pondComparisonRows.push(
      new TableRow({
        children: [
          createCell(c.pond?.name || 'Ao', true),
          createCell(c.stage === 'NURSERY' ? 'Ao Ương (GĐ 1)' : 'Thương phẩm (GĐ 2)'),
          createCell(`${c.pond?.areaSize || '--'} m²`),
          createCell(`${formatNumber(c.initialShrimpCount)} con`),
          createCell(`${r?.doc || cycle.durationDays} ngày`),
          createCell(`${formatNumber(kg, 1)} kg`),
          createCell(`${size} con/kg`),
          createCell(sr !== '--' ? `${sr}%` : '--'),
          createCell(`${fcr}`),
          createCell(formatVND(profit), true, false, AlignmentType.RIGHT),
        ],
      }),
    );
  });

  // Hàng tổng kết toàn vụ
  pondComparisonRows.push(
    new TableRow({
      children: [
        createCell('TOÀN VỤ', true),
        createCell(`${cycle.totals.totalPondsCount} ao`, true),
        createCell('--', true),
        createCell(`${formatNumber(cycle.totals.totalStockedShrimp)} con`, true),
        createCell(`${cycle.durationDays} ngày`, true),
        createCell(`${formatNumber(cycle.totals.totalHarvestKg, 1)} kg`, true),
        createCell(`${cycle.totals.avgHarvestSize || '--'} con/kg`, true),
        createCell(cycle.totals.overallSurvivalRate !== null ? `${cycle.totals.overallSurvivalRate}%` : '--', true),
        createCell(`${cycle.totals.avgFcr || '--'}`, true),
        createCell(formatVND(cycle.totals.totalProfit), true, false, AlignmentType.RIGHT),
      ],
    }),
  );

  const docx = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 24, font: 'Calibri' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, size: 22, font: 'Calibri', color: '334155' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '----------------o0o----------------', color: '64748B', size: 18 })],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'BÁO CÁO TỔNG KẾT TOÀN VỤ NUÔI TÔM', bold: true, size: 30, color: '1E40AF', font: 'Calibri' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Hệ thống SSFM • ${farmName} • Tổng hợp ${cycle.totals.totalPondsCount} ao nuôi`, italics: true, size: 20, color: '475569' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Ngày lập: ${formatDateVi(new Date())}`, italics: true, size: 19, color: '64748B' })],
          }),
          new Paragraph({ text: '' }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'I. THÔNG TIN HÀNH CHÍNH & MÔ HÌNH VỤ NUÔI', bold: true, size: 24, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createCell('Tên vụ nuôi:', true), createCell(`${cycleTitle} (${cycleCode})`), createCell('Trang trại:', true), createCell(farmName)] }),
              new TableRow({ children: [createCell('Mô hình nuôi:', true), createCell(cycle.isHighTech ? 'Công nghệ cao 2 giai đoạn (Ương ➔ Nuôi)' : 'Thương phẩm'), createCell('Tổng số ao tham gia:', true), createCell(`${cycle.totals.totalPondsCount} ao`)] }),
              new TableRow({ children: [createCell('Thời gian chu kỳ:', true), createCell(`${formatDateVi(cycle.startDate)} ➔ ${formatDateVi(cycle.endDate)} (${cycle.durationDays} ngày)`), createCell('Tổng giống thả ban đầu:', true), createCell(`${formatNumber(cycle.totals.totalStockedShrimp)} con`)] }),
              new TableRow({ children: [createCell('Tổng sản lượng thu hoạch:', true), createCell(`${formatNumber(cycle.totals.totalHarvestKg, 1)} kg (~${cycle.totals.totalHarvestTons} tấn)`), createCell('TỔNG LỢI NHUẬN RÒNG:', true), createCell(formatVND(cycle.totals.totalProfit), true)] }),
            ],
          }),
          new Paragraph({ text: '' }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'II. BẢNG TỔNG HỢP & SO SÁNH KẾT QUẢ THU HOẠCH TỪNG AO', bold: true, size: 24, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: pondComparisonRows,
          }),
          new Paragraph({ text: '' }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'III. HẠCH TOÁN TÀI CHÍNH TOÀN VỤ', bold: true, size: 24, color: '1E3A8A' })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createCell('Chỉ tiêu tài chính', true, true), createCell('Số tiền (VNĐ)', true, true, AlignmentType.RIGHT), createCell('Ghi chú / Tỷ lệ', true, true)] }),
              new TableRow({ children: [createCell('1. TỔNG CHI PHÍ HOẠT ĐỘNG TOÀN VỤ'), createCell(formatVND(cycle.totals.totalCost), false, false, AlignmentType.RIGHT), createCell('Tổng hợp các nhóm chi phí các ao')] }),
              new TableRow({ children: [createCell('2. TỔNG DOANH THU BÁN TÔM TOÀN VỤ'), createCell(formatVND(cycle.totals.totalRevenue), false, false, AlignmentType.RIGHT), createCell(`${formatNumber(cycle.totals.totalHarvestKg, 1)} kg tôm thương phẩm`)] }),
              new TableRow({ children: [createCell('3. TỔNG LỢI NHUẬN RÒNG (LÃI / LỖ)', true), createCell(formatVND(cycle.totals.totalProfit), true, false, AlignmentType.RIGHT), createCell(cycle.totals.totalRevenue > 0 ? `Biên lợi nhuận: ${((cycle.totals.totalProfit / cycle.totals.totalRevenue) * 100).toFixed(1)}%` : '--', true)] }),
            ],
          }),
          new Paragraph({ text: '' }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'IV. ĐÁNH GIÁ CHUYÊN MÔN VÀ KHUYẾN NGHỊ VỤ TIẾP THEO', bold: true, size: 24, color: '1E3A8A' })],
          }),
          new Paragraph({ children: [new TextRun({ text: '1. Đánh giá mô hình công nghệ cao: ', bold: true, color: '1E40AF' }), new TextRun({ text: 'Mô hình 2 giai đoạn phát huy hiệu quả cao trong việc tối ưu mật độ, rút ngắn thời gian nuôi thương phẩm và kiểm soát tốt hao hụt con giống.' })] }),
          new Paragraph({ children: [new TextRun({ text: '2. Bài học kinh nghiệm: ', bold: true, color: '1E40AF' }), new TextRun({ text: 'Cần duy trì giám sát đồng đều chất lượng nước giữa các ao, chuẩn bị ao thương phẩm kỹ lưỡng trước khi tách ao để tôm không bị sốc môi trường.' })] }),
          new Paragraph({ children: [new TextRun({ text: '3. Khuyến nghị cho vụ sau: ', bold: true, color: '1E40AF' }), new TextRun({ text: 'Tiếp tục áp dụng quy trình ương dưỡng chất lượng cao và đồng bộ hóa giờ cho ăn tự động giữa các ao nuôi.' })] }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'KỸ THUẬT VIÊN TRƯỞNG', bold: true, size: 21 })] }), new Paragraph({ text: '' }), new Paragraph({ text: '' }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '................................................', color: '94A3B8' })] })] }),
                  new TableCell({ borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'QUẢN LÝ TRANG TRẠI', bold: true, size: 21 })] }), new Paragraph({ text: '' }), new Paragraph({ text: '' }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '................................................', color: '94A3B8' })] })] }),
                  new TableCell({ borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CHỦ TRANG TRẠI / GIÁM ĐỐC', bold: true, size: 21 })] }), new Paragraph({ text: '' }), new Paragraph({ text: '' }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '................................................', color: '94A3B8' })] })] }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(docx);
  const fileName = generateReportFileName(null, 'docx', cycle, true);
  downloadBlob(blob, fileName);
};

// ============================================================================
// 3. XUẤT FILE PDF (.PDF) - TỪNG AO (TRỰC TIẾP TẢI FILE VỀ MÁY)
// ============================================================================
export const buildCropPdfDocument = (
  report: CropDetailedReportResponse,
  _cycle?: CropCycle | null,
): jsPDF => {
  const { crop, doc, feeding, financial } = report;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const primaryBlue = '#1E3A8A';
  const slateDark = '#0F172A';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(primaryBlue);
  pdf.text('HE THONG QUAN LY TRANG TRAI NUOI TOM (SSFM)', 105, 18, { align: 'center' });

  pdf.setFontSize(13);
  pdf.setTextColor(slateDark);
  pdf.text('BAO CAO TONG KET & NGHIEM THU VU NUOI', 105, 26, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor('#64748B');
  pdf.text(`Ao: ${toAsciiVi(crop.pond?.name || '--')} | Ngay xuat: ${formatDateVi(new Date())} | DOC: ${doc} ngay`, 105, 32, { align: 'center' });

  pdf.setDrawColor('#2563EB');
  pdf.setLineWidth(0.5);
  pdf.line(15, 36, 195, 36);

  // Summary box
  pdf.setFillColor('#F8FAFC');
  pdf.roundedRect(15, 40, 180, 32, 2, 2, 'F');
  pdf.setDrawColor('#E2E8F0');
  pdf.roundedRect(15, 40, 180, 32, 2, 2, 'D');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor('#475569');
  pdf.text('SAN LUONG THU HOACH', 25, 46);
  pdf.text('KICH CO TOM', 70, 46);
  pdf.text('TY LE SONG (SR)', 115, 46);
  pdf.text('LOI NHUAN RONG', 160, 46);

  pdf.setFontSize(12.5);
  pdf.setTextColor('#2563EB');
  pdf.text(`${formatNumber(financial.actualKg, 1)} kg`, 25, 54);

  pdf.setTextColor('#0F172A');
  pdf.text(`${financial.actualSize || '--'} con/kg`, 70, 54);

  pdf.setTextColor('#059669');
  pdf.text(`${financial.survivalRate !== null ? financial.survivalRate + '%' : '--'}`, 115, 54);

  pdf.setTextColor(financial.profit >= 0 ? '#16A34A' : '#DC2626');
  pdf.text(formatVND(financial.profit), 160, 54);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor('#64748B');
  pdf.text(`~ ${(financial.actualKg / 1000).toFixed(2)} tan`, 25, 60);
  pdf.text(`Muc tieu: ${crop.targetHarvestSize || '--'} con/kg`, 70, 60);
  pdf.text(`FCR: ${financial.fcr ?? '--'}`, 115, 60);
  pdf.text(`Doanh thu: ${formatVND(financial.actualRevenue)}`, 160, 60);

  // Financial table
  let currentY = 80;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(primaryBlue);
  pdf.text('1. BANG HACH TOAN CHI PHI & DOANH THU', 15, currentY);

  const costItems = [
    ['1. Chi phi con giong ban dau', formatVND(financial.costs.seed), `${crop.initialShrimpCount} con`],
    ['2. Chi phi thuc an nuoi tom', formatVND(financial.costs.feed), `${formatNumber(feeding.totalFeedKg, 1)} kg`],
    ['3. Chi phi thuoc thu y & men vi sinh', formatVND(financial.costs.medicine), 'Phong ngua & dieu tri'],
    ['4. Chi phi hoa chat & xu ly nuoc', formatVND(financial.costs.chemical), 'Cai tao ao dinh ky'],
    ['5. Chi phi dien & nhien lieu', formatVND(financial.costs.electricity), 'Quat khi & bom nuoc'],
    ['6. Chi phi nhan cong cham soc', formatVND(financial.costs.labor), 'Van hanh ao'],
    ['7. Chi phi quan ly & chi phi khac', formatVND(financial.costs.other), 'Khau hao & phan tich'],
  ];

  currentY += 4;
  pdf.setFillColor('#1E3A8A');
  pdf.rect(15, currentY, 180, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor('#FFFFFF');
  pdf.text('Khoan muc chi phi', 18, currentY + 5);
  pdf.text('So tien (VND)', 115, currentY + 5);
  pdf.text('Ghi chu', 150, currentY + 5);

  currentY += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor('#1E293B');

  costItems.forEach((item, idx) => {
    if (idx % 2 === 1) {
      pdf.setFillColor('#F8FAFC');
      pdf.rect(15, currentY, 180, 6, 'F');
    }
    pdf.text(item[0], 18, currentY + 4.5);
    pdf.text(item[1], 115, currentY + 4.5);
    pdf.text(item[2], 150, currentY + 4.5);
    pdf.setDrawColor('#E2E8F0');
    pdf.line(15, currentY + 6, 195, currentY + 6);
    currentY += 6;
  });

  // Totals
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor('#EFF6FF');
  pdf.rect(15, currentY, 180, 14, 'F');
  pdf.setTextColor('#1E3A8A');
  pdf.text('TONG CONG CHI PHI HOAT DONG:', 18, currentY + 5);
  pdf.text(formatVND(financial.costs.total), 115, currentY + 5);

  pdf.text('TONG DOANH THU THU HOACH:', 18, currentY + 10);
  pdf.setTextColor('#2563EB');
  pdf.text(formatVND(financial.actualRevenue), 115, currentY + 10);

  currentY += 15;
  pdf.setFillColor(financial.profit >= 0 ? '#DCFCE7' : '#FEE2E2');
  pdf.rect(15, currentY, 180, 8, 'F');
  pdf.setTextColor(financial.profit >= 0 ? '#166534' : '#991B1B');
  pdf.setFontSize(9.5);
  pdf.text('LOI NHUAN RONG DAT DUOC (LAI / LO):', 18, currentY + 5.5);
  pdf.text(formatVND(financial.profit), 115, currentY + 5.5);

  // Recommendations
  currentY += 16;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(primaryBlue);
  pdf.text('2. DANH GIA CHUYEN MON & KHUYEN NGHI QUAN LY', 15, currentY);

  currentY += 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor('#334155');
  pdf.text('- Danh gia vu: ' + toAsciiVi(crop.harvestEvaluation ? crop.harvestEvaluation.slice(0, 150) + '...' : 'Vu nuoi on dinh, kiem soat tot chi phi va moi truong.'), 18, currentY, { maxWidth: 174 });
  currentY += 9;
  pdf.text('- Bai hoc: ' + toAsciiVi(crop.harvestLessonsLearned ? crop.harvestLessonsLearned.slice(0, 150) + '...' : 'Duy tri do kiem va bo sung khoang truoc khi lot xac.'), 18, currentY, { maxWidth: 174 });
  currentY += 9;
  pdf.text('- Khuyen nghi: ' + toAsciiVi(crop.harvestNextRecommendation ? crop.harvestNextRecommendation.slice(0, 150) + '...' : 'Phat huy mo hinh cong nghe cao va giu mat do nuoi phu hop.'), 18, currentY, { maxWidth: 174 });

  // Signatures
  currentY += 18;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(slateDark);
  pdf.text('KY THUAT VIEN PHU TRACH', 35, currentY, { align: 'center' });
  pdf.text('QUAN LY TRANG TRAI', 105, currentY, { align: 'center' });
  pdf.text('CHU CO SO / GIAM DOC', 170, currentY, { align: 'center' });

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7.5);
  pdf.setTextColor('#64748B');
  pdf.text('(Ky va ghi ro ho ten)', 35, currentY + 4, { align: 'center' });
  pdf.text('(Ky va xac nhan)', 105, currentY + 4, { align: 'center' });
  pdf.text('(Ky va dong dau)', 170, currentY + 4, { align: 'center' });

  return pdf;
};

export const exportCropToDirectPdf = (
  report: CropDetailedReportResponse,
  cycle?: CropCycle | null,
) => {
  const pdf = buildCropPdfDocument(report, cycle);
  const fileName = generateReportFileName(report.crop, 'pdf', cycle);
  // Tải file trực tiếp về máy
  try {
    pdf.save(fileName);
  } catch {
    const blob = pdf.output('blob');
    downloadBlob(blob, fileName, 'application/pdf');
  }
};

// ============================================================================
// 3B. XUẤT FILE PDF (.PDF) TOÀN VỤ - TỔNG HỢP TẤT CẢ CÁC AO (TẢI VỀ MÁY)
// ============================================================================
export const exportCycleToDirectPdf = (
  cycle: CropCycle,
  reports: CropDetailedReportResponse[],
) => {
  const fileName = generateReportFileName(null, 'pdf', cycle, true);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const primaryBlue = '#1E3A8A';
  const slateDark = '#0F172A';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(primaryBlue);
  pdf.text('HE THONG QUAN LY TRANG TRAI NUOI TOM (SSFM)', 105, 18, { align: 'center' });

  pdf.setFontSize(13);
  pdf.setTextColor(slateDark);
  pdf.text('BAO CAO TONG KET TOAN VU NUOI (TAT CA CAC AO)', 105, 26, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor('#64748B');
  pdf.text(`Vu: ${toAsciiVi(cycle.name)} | Trang trai: ${toAsciiVi(cycle.farmName)} | ${cycle.totals.totalPondsCount} ao tham gia`, 105, 32, { align: 'center' });

  pdf.setDrawColor('#2563EB');
  pdf.setLineWidth(0.5);
  pdf.line(15, 36, 195, 36);

  // 4 KPI Cards
  pdf.setFillColor('#F8FAFC');
  pdf.roundedRect(15, 40, 180, 32, 2, 2, 'F');
  pdf.setDrawColor('#E2E8F0');
  pdf.roundedRect(15, 40, 180, 32, 2, 2, 'D');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor('#475569');
  pdf.text('TONG SAN LUONG VU', 22, 46);
  pdf.text('GIONG THA & AO', 68, 46);
  pdf.text('TY LE SONG (SR)', 114, 46);
  pdf.text('TONG LOI NHUAN RONG', 158, 46);

  pdf.setFontSize(12.5);
  pdf.setTextColor('#2563EB');
  pdf.text(`${formatNumber(cycle.totals.totalHarvestKg, 0)} kg`, 22, 54);

  pdf.setTextColor('#0F172A');
  pdf.text(`${formatNumber(cycle.totals.totalStockedShrimp)} con`, 68, 54);

  pdf.setTextColor('#059669');
  pdf.text(cycle.totals.overallSurvivalRate !== null ? `${cycle.totals.overallSurvivalRate}%` : '--', 114, 54);

  pdf.setTextColor(cycle.totals.totalProfit >= 0 ? '#16A34A' : '#DC2626');
  pdf.text(formatVND(cycle.totals.totalProfit), 158, 54);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor('#64748B');
  pdf.text(`~ ${cycle.totals.totalHarvestTons} tan`, 22, 60);
  pdf.text(`${cycle.totals.totalPondsCount} ao (${cycle.durationDays} ngay DOC)`, 68, 60);
  pdf.text(`FCR: ${cycle.totals.avgFcr ?? '--'}`, 114, 60);
  pdf.text(`Doanh thu: ${formatVND(cycle.totals.totalRevenue)}`, 158, 60);

  // Cross-pond comparison table
  let currentY = 80;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(primaryBlue);
  pdf.text('1. BANG TONG HOP & SO SANH CAC AO TRONG VU', 15, currentY);

  currentY += 4;
  pdf.setFillColor('#1E3A8A');
  pdf.rect(15, currentY, 180, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor('#FFFFFF');
  pdf.text('Ao nuoi', 18, currentY + 5);
  pdf.text('Vai tro', 45, currentY + 5);
  pdf.text('Giong tha', 75, currentY + 5);
  pdf.text('San luong (kg)', 105, currentY + 5);
  pdf.text('SR / FCR', 135, currentY + 5);
  pdf.text('Loi nhuan (VND)', 165, currentY + 5);

  currentY += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor('#1E293B');

  cycle.allCrops.forEach((c, idx) => {
    const r = reports.find((item) => item.crop.id === c.id);
    const kg = r?.financial.actualKg ?? c.actualHarvestKg ?? 0;
    const sr = r?.financial.survivalRate ?? c.actualHarvestSurvivalRate ?? '--';
    const fcr = r?.financial.fcr ?? c.actualHarvestFcr ?? '--';
    const profit = r?.financial.profit ?? c.actualHarvestProfit ?? 0;

    if (idx % 2 === 1) {
      pdf.setFillColor('#F8FAFC');
      pdf.rect(15, currentY, 180, 6, 'F');
    }
    pdf.text(toAsciiVi(c.pond?.name || `Ao ${idx + 1}`), 18, currentY + 4.5);
    pdf.text(c.stage === 'NURSERY' ? 'Ao Uong' : 'Thuong pham', 45, currentY + 4.5);
    pdf.text(`${formatNumber(c.initialShrimpCount)} con`, 75, currentY + 4.5);
    pdf.text(`${formatNumber(kg, 0)} kg`, 105, currentY + 4.5);
    pdf.text(`${sr !== '--' ? sr + '%' : '--'} / ${fcr}`, 135, currentY + 4.5);
    pdf.text(formatVND(profit), 165, currentY + 4.5);

    pdf.setDrawColor('#E2E8F0');
    pdf.line(15, currentY + 6, 195, currentY + 6);
    currentY += 6;
  });

  // Hàng tổng kết
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor('#EFF6FF');
  pdf.rect(15, currentY, 180, 7, 'F');
  pdf.setTextColor('#1E3A8A');
  pdf.text('TONG CONG TOAN VU:', 18, currentY + 5);
  pdf.text(`${cycle.totals.totalPondsCount} ao`, 45, currentY + 5);
  pdf.text(`${formatNumber(cycle.totals.totalStockedShrimp)} con`, 75, currentY + 5);
  pdf.text(`${formatNumber(cycle.totals.totalHarvestKg, 0)} kg`, 105, currentY + 5);
  pdf.text(`${cycle.totals.overallSurvivalRate ?? '--'}% / ${cycle.totals.avgFcr ?? '--'}`, 135, currentY + 5);
  pdf.text(formatVND(cycle.totals.totalProfit), 165, currentY + 5);

  currentY += 12;

  // Financial Summary Section
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(primaryBlue);
  pdf.text('2. HACH TOAN TAI CHINH & CHI PHI TOAN VU', 15, currentY);

  currentY += 4;
  pdf.setFillColor('#F8FAFC');
  pdf.rect(15, currentY, 180, 18, 'F');
  pdf.setDrawColor('#E2E8F0');
  pdf.rect(15, currentY, 180, 18, 'D');

  pdf.setFontSize(8.5);
  pdf.setTextColor('#475569');
  pdf.text('Tong chi phi hoat dong toan vu:', 20, currentY + 6);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#0F172A');
  pdf.text(formatVND(cycle.totals.totalCost), 85, currentY + 6);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor('#475569');
  pdf.text('Tong doanh thu thu hoach toan vu:', 20, currentY + 12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#2563EB');
  pdf.text(formatVND(cycle.totals.totalRevenue), 85, currentY + 12);

  pdf.setFillColor(cycle.totals.totalProfit >= 0 ? '#DCFCE7' : '#FEE2E2');
  pdf.rect(125, currentY + 2, 65, 14, 'F');
  pdf.setFontSize(8);
  pdf.setTextColor(cycle.totals.totalProfit >= 0 ? '#166534' : '#991B1B');
  pdf.text('LOI NHUAN RONG TOAN VU:', 128, currentY + 7);
  pdf.setFontSize(10);
  pdf.text(formatVND(cycle.totals.totalProfit), 128, currentY + 13);

  currentY += 24;

  // Signatures
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(slateDark);
  pdf.text('KY THUAT VIEN TRUONG', 35, currentY, { align: 'center' });
  pdf.text('QUAN LY TRANG TRAI', 105, currentY, { align: 'center' });
  pdf.text('CHU TRANG TRAI / GIAM DOC', 170, currentY, { align: 'center' });

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7.5);
  pdf.setTextColor('#64748B');
  pdf.text('(Ky va ghi ro ho ten)', 35, currentY + 4, { align: 'center' });
  pdf.text('(Ky va xac nhan)', 105, currentY + 4, { align: 'center' });
  pdf.text('(Ky va dong dau)', 170, currentY + 4, { align: 'center' });

  // Tải trực tiếp file PDF về máy
  try {
    pdf.save(fileName);
  } catch {
    const blob = pdf.output('blob');
    downloadBlob(blob, fileName, 'application/pdf');
  }
};

// ============================================================================
// 4. MỞ BẢN IN XEM TRƯỚC / IN VECTOR (POPUP HTML)
// ============================================================================
export const exportCropToPdfPrint = (
  report: CropDetailedReportResponse,
  cycle?: CropCycle | null,
) => {
  const { crop, doc, feeding, financial } = report;
  const farmName = cycle?.farmName || crop.pond?.farm?.name || 'Trang trại Thủy sản Thông minh';
  const pondName = crop.pond?.name || 'Ao nuôi';
  const cycleTitle = cycle?.name || `Vụ nuôi ${pondName}`;
  const cycleCode = cycle?.code || `VU-${crop.id.slice(0, 6).toUpperCase()}`;
  const fileName = generateReportFileName(crop, 'pdf', cycle);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Vui lòng cho phép mở cửa sổ popup để xem trước và in báo cáo PDF!');
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.45; margin: 0; padding: 0; font-size: 13px; background: #ffffff; }
    .header-banner { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
    .brand-title { font-size: 18px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; }
    .brand-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
    .report-title-box { text-align: center; margin: 15px 0 20px 0; }
    .report-title { font-size: 20px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin: 0 0 4px 0; }
    .report-meta { font-size: 12px; color: #64748b; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
    .kpi-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
    .kpi-value { font-size: 16px; font-weight: 800; color: #0f172a; }
    .kpi-sub { font-size: 10px; color: #10b981; font-weight: 600; margin-top: 2px; }
    .section-title { font-size: 14px; font-weight: 700; color: #1e3a8a; border-left: 4px solid #2563eb; padding-left: 8px; margin: 16px 0 8px 0; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
    th { background: #f1f5f9; color: #1e293b; font-weight: 700; font-size: 11.5px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .highlight-row { background: #f8fafc; font-weight: 700; }
    .profit-row { background: #eff6ff; font-weight: 800; color: #1e40af; }
    .review-box { background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; font-size: 12px; }
    .review-title { font-weight: 700; color: #1e40af; margin-bottom: 3px; }
    .signature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 25px; text-align: center; page-break-inside: avoid; }
    .sig-title { font-weight: 700; font-size: 12px; color: #0f172a; }
    .sig-sub { font-size: 11px; color: #64748b; font-style: italic; margin-top: 2px; }
    .sig-space { height: 60px; }
    .no-print-bar { background: #1e293b; color: #ffffff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; }
    .btn-action { background: #2563eb; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
    .btn-action:hover { background: #1d4ed8; }
    @media print { .no-print-bar { display: none !important; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Hệ thống SSFM</strong> • Báo cáo in PDF vụ nuôi: <em>${cycleTitle}</em></div>
    <div style="display:flex; gap:10px;">
      <button class="btn-action" onclick="window.print()">🖨️ Lưu file PDF / In báo cáo</button>
      <button class="btn-action" style="background:#64748b;" onclick="window.close()">Đóng</button>
    </div>
  </div>

  <div style="padding: 10px 0;">
    <div class="header-banner">
      <div>
        <div class="brand-title">HỆ THỐNG SMART SHRIMP FARM MANAGEMENT (SSFM)</div>
        <div class="brand-sub">${farmName} • Hệ thống Quản trị & Giám sát Nuôi tôm Thông minh</div>
      </div>
      <div style="text-align: right;">
        <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold;">✓ ĐÃ THU HOẠCH</span>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Mã vụ: <strong>${cycleCode}</strong></div>
      </div>
    </div>

    <div class="report-title-box">
      <h1 class="report-title">BÁO CÁO TỔNG KẾT & NGHIỆM THU VỤ NUÔI TÔM</h1>
      <div class="report-meta">Ao nuôi: <strong>${pondName}</strong> | DOC: <strong>${doc} ngày</strong> | Ngày lập: <strong>${formatDateVi(new Date())}</strong></div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Sản lượng thu hoạch</div><div class="kpi-value" style="color: #2563eb;">${formatNumber(financial.actualKg, 1)} kg</div><div class="kpi-sub">~ ${(financial.actualKg / 1000).toFixed(2)} tấn</div></div>
      <div class="kpi-card"><div class="kpi-label">Kích cỡ tôm</div><div class="kpi-value">${financial.actualSize || '--'} con/kg</div><div class="kpi-sub" style="color: #64748b;">Mục tiêu: ${crop.targetHarvestSize || '--'} con/kg</div></div>
      <div class="kpi-card"><div class="kpi-label">Tỷ lệ sống (SR)</div><div class="kpi-value" style="color: #059669;">${financial.survivalRate !== null ? financial.survivalRate + '%' : '--'}</div><div class="kpi-sub" style="color: #64748b;">Mục tiêu: ${crop.targetSurvivalRate || '--'}%</div></div>
      <div class="kpi-card"><div class="kpi-label">Lợi nhuận ròng</div><div class="kpi-value" style="color: ${financial.profit >= 0 ? '#16a34a' : '#dc2626'};">${formatVND(financial.profit)}</div><div class="kpi-sub" style="color: #64748b;">Doanh thu: ${formatVND(financial.actualRevenue)}</div></div>
    </div>

    <div class="section-title">1. Thông tin quản lý & con giống</div>
    <table>
      <tr>
        <td style="width: 25%; font-weight: bold; background: #f8fafc;">Trang trại:</td><td style="width: 25%;">${farmName}</td>
        <td style="width: 25%; font-weight: bold; background: #f8fafc;">Ao nuôi / Diện tích:</td><td style="width: 25%;">${pondName} (${crop.pond?.areaSize || '--'} m²)</td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f8fafc;">Ngày bắt đầu thả:</td><td>${formatDateVi(crop.startDate)}</td>
        <td style="font-weight: bold; background: #f8fafc;">Ngày thu hoạch:</td><td>${formatDateVi(crop.actualHarvestDate || crop.expectedHarvestDate)}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f8fafc;">Loại con giống:</td><td>${crop.seedType || 'Tôm thẻ chân trắng'}</td>
        <td style="font-weight: bold; background: #f8fafc;">Số lượng giống thả:</td><td><strong>${formatNumber(crop.initialShrimpCount)} con</strong></td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f8fafc;">Hệ số thức ăn (FCR):</td><td><strong>${financial.fcr ?? '--'}</strong></td>
        <td style="font-weight: bold; background: #f8fafc;">Tổng thức ăn đã cấp:</td><td>${formatNumber(feeding.totalFeedKg, 1)} kg</td>
      </tr>
    </table>

    <div class="section-title">2. Hạch toán chi phí & doanh thu</div>
    <table>
      <thead><tr><th>STT</th><th>Khoản mục chi phí hoạt động</th><th class="text-right">Số tiền (VNĐ)</th><th class="text-right">Tỷ trọng chi phí</th><th>Ghi chú</th></tr></thead>
      <tbody>
        <tr><td class="text-center">1</td><td>Chi phí con giống ban đầu</td><td class="text-right">${formatVND(financial.costs.seed)}</td><td class="text-right">${financial.costs.total > 0 ? ((financial.costs.seed / financial.costs.total) * 100).toFixed(1) + '%' : '--'}</td><td>Đơn giá: ${formatVND(crop.seedUnitPrice)}/con</td></tr>
        <tr><td class="text-center">2</td><td>Chi phí thức ăn nuôi tôm</td><td class="text-right">${formatVND(financial.costs.feed)}</td><td class="text-right">${financial.costs.total > 0 ? ((financial.costs.feed / financial.costs.total) * 100).toFixed(1) + '%' : '--'}</td><td>Tổng: ${formatNumber(feeding.totalFeedKg, 1)} kg</td></tr>
        <tr><td class="text-center">3</td><td>Chi phí thuốc thú y & men vi sinh</td><td class="text-right">${formatVND(financial.costs.medicine)}</td><td class="text-right">${financial.costs.total > 0 ? ((financial.costs.medicine / financial.costs.total) * 100).toFixed(1) + '%' : '--'}</td><td>Phòng ngừa & điều trị</td></tr>
        <tr><td class="text-center">4</td><td>Chi phí hóa chất & xử lý nước</td><td class="text-right">${formatVND(financial.costs.chemical)}</td><td class="text-right">${financial.costs.total > 0 ? ((financial.costs.chemical / financial.costs.total) * 100).toFixed(1) + '%' : '--'}</td><td>Cải tạo ao định kỳ</td></tr>
        <tr><td class="text-center">5</td><td>Chi phí điện & nhiên liệu</td><td class="text-right">${formatVND(financial.costs.electricity)}</td><td class="text-right">${financial.costs.total > 0 ? ((financial.costs.electricity / financial.costs.total) * 100).toFixed(1) + '%' : '--'}</td><td>Quạt khí & bơm nước</td></tr>
        <tr><td class="text-center">6</td><td>Chi phí nhân công chăm sóc</td><td class="text-right">${formatVND(financial.costs.labor)}</td><td class="text-right">${financial.costs.total > 0 ? ((financial.costs.labor / financial.costs.total) * 100).toFixed(1) + '%' : '--'}</td><td>Vận hành ao</td></tr>
        <tr><td class="text-center">7</td><td>Chi phí khác</td><td class="text-right">${formatVND(financial.costs.other)}</td><td class="text-right">${financial.costs.other > 0 && financial.costs.total > 0 ? ((financial.costs.other / financial.costs.total) * 100).toFixed(1) + '%' : '--'}</td><td>Khấu hao, xét nghiệm</td></tr>
        <tr class="highlight-row"><td colspan="2" class="font-bold">TỔNG CỘNG CHI PHÍ HOẠT ĐỘNG</td><td class="text-right font-bold">${formatVND(financial.costs.total)}</td><td class="text-right font-bold">100.0%</td><td></td></tr>
        <tr class="highlight-row"><td colspan="2" class="font-bold">TỔNG DOANH THU THU HOẠCH</td><td class="text-right font-bold" style="color: #2563eb;">${formatVND(financial.actualRevenue)}</td><td colspan="2">Đơn giá bán: ${formatVND(crop.actualHarvestPricePerKg)} / kg</td></tr>
        <tr class="profit-row"><td colspan="2" class="font-bold">LỢI NHUẬN RÒNG ĐẠT ĐƯỢC (LÃI / LỖ)</td><td class="text-right font-bold">${formatVND(financial.profit)}</td><td colspan="2">Biên lợi nhuận: ${financial.actualRevenue > 0 ? ((financial.profit / financial.actualRevenue) * 100).toFixed(1) + '%' : '--'}</td></tr>
      </tbody>
    </table>

    <div class="section-title">3. Đánh giá chuyên môn & khuyến nghị</div>
    <div class="review-box"><div class="review-title">🔍 Đánh giá tổng quan vụ:</div><div>${crop.harvestEvaluation || 'Vụ nuôi đạt kết quả tốt, sản lượng và tỷ lệ sống đáp ứng kế hoạch. FCR được kiểm soát tối ưu.'}</div></div>
    <div class="review-box" style="border-left-color: #f59e0b;"><div class="review-title" style="color: #d97706;">💡 Bài học kinh nghiệm:</div><div>${crop.harvestLessonsLearned || 'Duy trì sục khí ban đêm và bổ sung khoáng chất định kỳ trước ngày lột xác.'}</div></div>
    <div class="review-box" style="border-left-color: #10b981;"><div class="review-title" style="color: #059669;">🚀 Khuyến nghị vụ sau:</div><div>${crop.harvestNextRecommendation || 'Tiếp tục áp dụng quy trình công nghệ cao và giữ mật độ nuôi thích hợp.'}</div></div>

    <div class="signature-grid">
      <div><div class="sig-title">KỸ THUẬT VIÊN PHỤ TRÁCH</div><div class="sig-sub">(Ký và ghi rõ họ tên)</div><div class="sig-space"></div><div style="color: #64748b;">................................................</div></div>
      <div><div class="sig-title">QUẢN LÝ TRANG TRẠI</div><div class="sig-sub">(Ký và xác nhận)</div><div class="sig-space"></div><div style="color: #64748b;">................................................</div></div>
      <div><div class="sig-title">CHỦ TRANG TRẠI / GIÁM ĐỐC</div><div class="sig-sub">(Ký, đóng dấu xác nhận)</div><div class="sig-space"></div><div style="color: #64748b;">................................................</div></div>
    </div>
  </div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 600); };
  </script>
</body>
</html>
`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

// ============================================================================
// 4B. MỞ BẢN IN XEM TRƯỚC / IN VECTOR TOÀN VỤ (POPUP HTML)
// ============================================================================
export const exportCycleToPdfPrint = (
  cycle: CropCycle,
  reports: CropDetailedReportResponse[],
) => {
  const farmName = cycle.farmName || 'Trang trại Thủy sản Thông minh';
  const cycleTitle = cycle.name || 'Vụ nuôi';
  const cycleCode = cycle.code || 'VU-ALL';
  const fileName = generateReportFileName(null, 'pdf', cycle, true);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Vui lòng cho phép mở cửa sổ popup để xem trước và in báo cáo PDF!');
    return;
  }

  const pondRowsHtml = cycle.allCrops.map((c, idx) => {
    const r = reports.find((item) => item.crop.id === c.id);
    const kg = r?.financial.actualKg ?? c.actualHarvestKg ?? 0;
    const size = r?.financial.actualSize ?? c.actualHarvestSize ?? '--';
    const sr = r?.financial.survivalRate ?? c.actualHarvestSurvivalRate ?? '--';
    const fcr = r?.financial.fcr ?? c.actualHarvestFcr ?? '--';
    const rev = r?.financial.actualRevenue ?? c.actualHarvestRevenue ?? 0;
    const cost = r?.financial.costs.total ?? c.actualHarvestCost ?? 0;
    const profit = r?.financial.profit ?? c.actualHarvestProfit ?? 0;

    return `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><strong>${c.pond?.name || `Ao ${idx + 1}`}</strong></td>
        <td>${c.stage === 'NURSERY' ? 'Ao Ương (GĐ 1)' : 'Thương phẩm (GĐ 2)'}</td>
        <td class="text-center">${c.pond?.areaSize || '--'} m²</td>
        <td class="text-right">${formatNumber(c.initialShrimpCount)} con</td>
        <td class="text-right font-bold" style="color: #2563eb;">${formatNumber(kg, 1)} kg</td>
        <td class="text-center">${size}</td>
        <td class="text-center">${sr !== '--' ? sr + '%' : '--'}</td>
        <td class="text-center">${fcr}</td>
        <td class="text-right">${formatVND(cost)}</td>
        <td class="text-right">${formatVND(rev)}</td>
        <td class="text-right font-bold" style="color: ${profit >= 0 ? '#16a34a' : '#dc2626'};">${formatVND(profit)}</td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; padding: 0; font-size: 12.5px; background: #ffffff; }
    .header-banner { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 14px; }
    .brand-title { font-size: 17px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; }
    .brand-sub { font-size: 11.5px; color: #64748b; margin-top: 2px; }
    .report-title-box { text-align: center; margin: 12px 0 16px 0; }
    .report-title { font-size: 19px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin: 0 0 4px 0; }
    .report-meta { font-size: 12px; color: #64748b; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
    .kpi-label { font-size: 10.5px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 3px; }
    .kpi-value { font-size: 15px; font-weight: 800; color: #0f172a; }
    .kpi-sub { font-size: 10px; color: #64748b; font-weight: 500; margin-top: 2px; }
    .section-title { font-size: 13px; font-weight: 700; color: #1e3a8a; border-left: 4px solid #2563eb; padding-left: 8px; margin: 14px 0 7px 0; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11.5px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
    th { background: #f1f5f9; color: #1e293b; font-weight: 700; font-size: 11px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .highlight-row { background: #eff6ff; font-weight: 700; color: #1e40af; }
    .review-box { background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; font-size: 11.5px; }
    .review-title { font-weight: 700; color: #1e40af; margin-bottom: 2px; }
    .signature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 22px; text-align: center; page-break-inside: avoid; }
    .sig-title { font-weight: 700; font-size: 11.5px; color: #0f172a; }
    .sig-sub { font-size: 10.5px; color: #64748b; font-style: italic; margin-top: 2px; }
    .sig-space { height: 50px; }
    .no-print-bar { background: #1e293b; color: #ffffff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; }
    .btn-action { background: #2563eb; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
    .btn-action:hover { background: #1d4ed8; }
    @media print { .no-print-bar { display: none !important; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Hệ thống SSFM</strong> • Báo cáo in PDF TOÀN VỤ: <em>${cycleTitle}</em> (${cycle.totals.totalPondsCount} ao)</div>
    <div style="display:flex; gap:10px;">
      <button class="btn-action" onclick="window.print()">🖨️ Lưu file PDF / In báo cáo</button>
      <button class="btn-action" style="background:#64748b;" onclick="window.close()">Đóng</button>
    </div>
  </div>

  <div style="padding: 10px 0;">
    <div class="header-banner">
      <div>
        <div class="brand-title">HỆ THỐNG SMART SHRIMP FARM MANAGEMENT (SSFM)</div>
        <div class="brand-sub">${farmName} • Hệ thống Quản trị & Giám sát Nuôi tôm Thông minh</div>
      </div>
      <div style="text-align: right;">
        <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold;">
          ${cycle.status === 'COMPLETED' ? '✓ ĐÃ THU HOẠCH' : '🟢 ĐANG NUÔI'}
        </span>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Mã vụ: <strong>${cycleCode}</strong></div>
      </div>
    </div>

    <div class="report-title-box">
      <h1 class="report-title">BÁO CÁO TỔNG KẾT TOÀN VỤ NUÔI TÔM</h1>
      <div class="report-meta">Phạm vi: <strong>Tất cả ${cycle.totals.totalPondsCount} ao nuôi</strong> | Chu kỳ: <strong>${cycle.durationDays} ngày (${formatDateVi(cycle.startDate)} ➔ ${formatDateVi(cycle.endDate)})</strong> | Ngày lập: <strong>${formatDateVi(new Date())}</strong></div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Tổng sản lượng toàn vụ</div><div class="kpi-value" style="color: #2563eb;">${formatNumber(cycle.totals.totalHarvestKg, 1)} kg</div><div class="kpi-sub">~ ${cycle.totals.totalHarvestTons} tấn tôm</div></div>
      <div class="kpi-card"><div class="kpi-label">Quy mô & Giống thả</div><div class="kpi-value">${formatNumber(cycle.totals.totalStockedShrimp)} con</div><div class="kpi-sub">${cycle.totals.totalPondsCount} ao (${cycle.isHighTech ? 'Công nghệ cao' : 'Thương phẩm'})</div></div>
      <div class="kpi-card"><div class="kpi-label">Tỷ lệ sống & FCR</div><div class="kpi-value" style="color: #059669;">${cycle.totals.overallSurvivalRate !== null ? cycle.totals.overallSurvivalRate + '%' : '--'}</div><div class="kpi-sub">FCR bình quân: ${cycle.totals.avgFcr ?? '--'}</div></div>
      <div class="kpi-card"><div class="kpi-label">Tổng lợi nhuận ròng</div><div class="kpi-value" style="color: ${cycle.totals.totalProfit >= 0 ? '#16a34a' : '#dc2626'};">${formatVND(cycle.totals.totalProfit)}</div><div class="kpi-sub">Doanh thu: ${formatVND(cycle.totals.totalRevenue)}</div></div>
    </div>

    <div class="section-title">1. Bảng tổng hợp & so sánh hiệu quả các ao trong vụ</div>
    <table>
      <thead>
        <tr>
          <th class="text-center">STT</th>
          <th>Ao nuôi</th>
          <th>Vai trò</th>
          <th class="text-center">Diện tích</th>
          <th class="text-right">Giống thả</th>
          <th class="text-right">Sản lượng</th>
          <th class="text-center">Cỡ tôm</th>
          <th class="text-center">Tỷ lệ sống</th>
          <th class="text-center">FCR</th>
          <th class="text-right">Chi phí (đ)</th>
          <th class="text-right">Doanh thu (đ)</th>
          <th class="text-right">Lợi nhuận (đ)</th>
        </tr>
      </thead>
      <tbody>
        ${pondRowsHtml}
        <tr class="highlight-row">
          <td colspan="4" class="font-bold">TỔNG CỘNG / BÌNH QUÂN TOÀN VỤ (${cycle.totals.totalPondsCount} AO)</td>
          <td class="text-right font-bold">${formatNumber(cycle.totals.totalStockedShrimp)} con</td>
          <td class="text-right font-bold" style="color: #2563eb;">${formatNumber(cycle.totals.totalHarvestKg, 1)} kg</td>
          <td class="text-center font-bold">${cycle.totals.avgHarvestSize || '--'}</td>
          <td class="text-center font-bold" style="color: #059669;">${cycle.totals.overallSurvivalRate !== null ? cycle.totals.overallSurvivalRate + '%' : '--'}</td>
          <td class="text-center font-bold">${cycle.totals.avgFcr || '--'}</td>
          <td class="text-right font-bold">${formatVND(cycle.totals.totalCost)}</td>
          <td class="text-right font-bold">${formatVND(cycle.totals.totalRevenue)}</td>
          <td class="text-right font-bold" style="color: ${cycle.totals.totalProfit >= 0 ? '#16a34a' : '#dc2626'};">${formatVND(cycle.totals.totalProfit)}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">2. Hạch toán tài chính toàn vụ</div>
    <table>
      <thead><tr><th>Chỉ tiêu tài chính toàn vụ</th><th class="text-right">Số tiền (VNĐ)</th><th>Chi tiết / Đánh giá</th></tr></thead>
      <tbody>
        <tr><td>Tổng chi phí hoạt động toàn vụ (Tất cả ${cycle.totals.totalPondsCount} ao)</td><td class="text-right font-bold">${formatVND(cycle.totals.totalCost)}</td><td>Bao gồm: Con giống, Thức ăn, Thuốc & Vi sinh, Điện dầu, Nhân công</td></tr>
        <tr><td>Tổng doanh thu bán tôm toàn vụ</td><td class="text-right font-bold" style="color: #2563eb;">${formatVND(cycle.totals.totalRevenue)}</td><td>Tổng sản lượng: ${formatNumber(cycle.totals.totalHarvestKg, 1)} kg (~${cycle.totals.totalHarvestTons} tấn)</td></tr>
        <tr class="highlight-row"><td class="font-bold">TỔNG LỢI NHUẬN RÒNG ĐẠT ĐƯỢC (LÃI / LỖ)</td><td class="text-right font-bold" style="font-size: 13px; color: ${cycle.totals.totalProfit >= 0 ? '#16a34a' : '#dc2626'};">${formatVND(cycle.totals.totalProfit)}</td><td class="font-bold">Biên lợi nhuận: ${cycle.totals.totalRevenue > 0 ? ((cycle.totals.totalProfit / cycle.totals.totalRevenue) * 100).toFixed(1) + '%' : '--'}</td></tr>
      </tbody>
    </table>

    <div class="section-title">3. Đánh giá chuyên môn & bài học kinh nghiệm</div>
    <div class="review-box"><div class="review-title">🔍 Đánh giá tổng quan mô hình nuôi:</div><div>Mô hình nuôi tôm nhiều giai đoạn kiểm soát tốt dịch bệnh, tối ưu hóa diện tích nuôi và tỷ lệ sống bình quân toàn vụ đạt ${cycle.totals.overallSurvivalRate || '--'}%.</div></div>
    <div class="review-box" style="border-left-color: #f59e0b;"><div class="review-title" style="color: #d97706;">💡 Bài học kinh nghiệm vận hành:</div><div>Theo dõi đồng đều giữa ao ương và các ao thương phẩm, chuẩn bị nước kỹ trước ngày san ao để tôm không bị phân cỡ hoặc chững ăn.</div></div>
    <div class="review-box" style="border-left-color: #10b981;"><div class="review-title" style="color: #059669;">🚀 Khuyến nghị cho vụ tiếp theo:</div><div>Phát huy mô hình chuyển ao theo giai đoạn, tăng cường ứng dụng cảm biến tự động giám sát môi trường liên tục để giảm rủi ro.</div></div>

    <div class="signature-grid">
      <div><div class="sig-title">KỸ THUẬT VIÊN TRƯỞNG</div><div class="sig-sub">(Ký và ghi rõ họ tên)</div><div class="sig-space"></div><div style="color: #64748b;">................................................</div></div>
      <div><div class="sig-title">QUẢN LÝ TRANG TRẠI</div><div class="sig-sub">(Ký và xác nhận)</div><div class="sig-space"></div><div style="color: #64748b;">................................................</div></div>
      <div><div class="sig-title">CHỦ TRANG TRẠI / GIÁM ĐỐC</div><div class="sig-sub">(Ký, đóng dấu xác nhận)</div><div class="sig-space"></div><div style="color: #64748b;">................................................</div></div>
    </div>
  </div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 600); };
  </script>
</body>
</html>
`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

// ============================================================================
// 5. XUẤT TOÀN BỘ BÁO CÁO VỤ NUÔI THÀNH FILE NÉN ZIP
// - Chứa các folder con đặt tên theo từng ao trong vụ (Ao nuôi A1, Ao nuôi A2, Ao ươm...)
// - Mỗi folder con chứa đầy đủ 3 file: PDF, Word (.docx) và Excel (.xlsx) của ao đó
// ============================================================================
export const exportCycleToZip = async (
  cycle: CropCycle,
  reports: CropDetailedReportResponse[],
) => {
  const zip = new JSZip();

  for (let i = 0; i < cycle.allCrops.length; i++) {
    const crop = cycle.allCrops[i];
    const report = reports.find((r) => r.crop.id === crop.id);
    if (!report) continue;

    // Tên folder cho ao: Ví dụ: "Ao nuôi A1", "Ao nuôi B1 (Ao ươm)"
    let pondFolderName = crop.pond?.name || `Ao nuôi ${i + 1}`;
    if (crop.stage === 'NURSERY') {
      const lower = pondFolderName.toLowerCase();
      if (!lower.includes('ươm') && !lower.includes('uom')) {
        pondFolderName = `${pondFolderName} (Ao ươm)`;
      }
    }

    const pondFolder = zip.folder(pondFolderName);
    if (!pondFolder) continue;

    // 1. File Excel (.xlsx) của ao
    const wb = buildCropWorkbook(report, cycle);
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const excelName = generateReportFileName(crop, 'xlsx', cycle);
    pondFolder.file(excelName, excelBuffer);

    // 2. File Word (.docx) của ao
    const docx = buildCropDocxDocument(report, cycle);
    const docxBlob = await Packer.toBlob(docx);
    const docxName = generateReportFileName(crop, 'docx', cycle);
    pondFolder.file(docxName, docxBlob);

    // 3. File PDF (.pdf) của ao
    const pdf = buildCropPdfDocument(report, cycle);
    const pdfBlob = pdf.output('blob');
    const pdfName = generateReportFileName(crop, 'pdf', cycle);
    pondFolder.file(pdfName, pdfBlob);
  }

  const rawDate = cycle.endDate || new Date();
  const dateStr = formatDateVi(rawDate).replace(/\//g, '-');
  const zipFileName = `BaoCao_ToanVu_${sanitizeFileName(cycle.name)}_${dateStr}.zip`;

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  downloadBlob(zipBlob, zipFileName, 'application/zip');
};

// Alias tương thích ngược
export const exportCropToPdf = exportCropToPdfPrint;


