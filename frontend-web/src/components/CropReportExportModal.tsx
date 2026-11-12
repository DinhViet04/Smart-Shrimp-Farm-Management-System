import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  FileSpreadsheet,
  FileDown,
  Printer,
  Waves,
  Building2,
  Loader2,
  Layers,
  ExternalLink,
  Archive,
  FolderTree,
  Folder,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cropService, type CropDetailedReportResponse, type Crop } from '../services/crop.service';
import { type CropCycle } from '../utils/cropCycleGrouping';
import {
  exportCropToExcel,
  exportCropToDocx,
  exportCropToDirectPdf,
  exportCropToPdfPrint,
  exportCycleToZip,
  formatVND,
  formatNumber,
} from '../utils/cropReportExporter';

interface CropReportExportModalProps {
  isOpen: boolean;
  crop?: Crop | null;
  cycle?: CropCycle | null;
  onClose: () => void;
  onOpenDetailedPreview?: (crop: Crop) => void;
}

type ExportFormat = 'pdf' | 'docx' | 'xlsx' | 'pdf_print';
type PondSelection = 'ALL' | string;

export default function CropReportExportModal({
  isOpen,
  crop: initialCrop,
  cycle,
  onClose,
  onOpenDetailedPreview,
}: CropReportExportModalProps) {
  // Danh sách các ao trong vụ nuôi
  const availableCrops: Crop[] =
    cycle?.allCrops && cycle.allCrops.length > 0
      ? cycle.allCrops
      : initialCrop
      ? [initialCrop]
      : [];

  // Mặc định chọn 'ALL' (Báo cáo Toàn vụ) nếu có thông tin vụ nuôi gồm nhiều ao
  const [selectedPond, setSelectedPond] = useState<PondSelection>(() => {
    if (cycle && cycle.allCrops && cycle.allCrops.length > 1) {
      return 'ALL';
    }
    return initialCrop?.id || availableCrops[0]?.id || 'ALL';
  });

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingFormat, setDownloadingFormat] = useState<ExportFormat | 'all' | 'zip' | null>(null);

  // Cập nhật selectedPond khi initialCrop hoặc cycle thay đổi
  React.useEffect(() => {
    if (cycle && cycle.allCrops && cycle.allCrops.length > 1) {
      setSelectedPond('ALL');
    } else if (initialCrop?.id) {
      setSelectedPond(initialCrop.id);
    } else if (availableCrops[0]?.id) {
      setSelectedPond(availableCrops[0].id);
    }
  }, [initialCrop, cycle]);

  if (!isOpen) return null;

  const isFullCycleMode = selectedPond === 'ALL' && !!cycle;
  const currentCrop = isFullCycleMode
    ? availableCrops[0]
    : availableCrops.find((c) => c.id === selectedPond) || availableCrops[0];

  if (!currentCrop && !cycle) return null;

  const cycleTitle = cycle?.name || `Vụ nuôi ao ${currentCrop?.pond?.name || ''}`;
  const farmName = cycle?.farmName || currentCrop?.pond?.farm?.name || 'Trang trại Thủy sản';

  // Validation: Vụ hoặc ao đã thu hoạch mới được tải file báo cáo
  const isTargetHarvested = isFullCycleMode
    ? cycle?.status === 'COMPLETED'
    : currentCrop?.status === 'HARVESTED';

  // Hàm tải dữ liệu báo cáo chi tiết từ Backend
  const fetchDetailedReport = async (cropId: string): Promise<CropDetailedReportResponse> => {
    return await cropService.getDetailedReport(cropId);
  };

  // Xử lý xuất toàn bộ báo cáo vụ nuôi thành file nén ZIP
  const handleExportZip = async () => {
    if (!cycle) return;
    if (cycle.status !== 'COMPLETED') {
      toast.error('Vụ nuôi này đang nuôi, chưa thu hoạch nên chưa thể tải báo cáo toàn vụ!', { id: 'export-toast' });
      return;
    }

    setDownloadingFormat('zip');
    setLoading(true);
    try {
      toast.loading(`Đang khởi tạo dữ liệu của tất cả ${cycle.totals.totalPondsCount} ao trong vụ...`, { id: 'export-toast' });
      const allReports = await Promise.all(
        cycle.allCrops.map((c) => fetchDetailedReport(c.id))
      );

      toast.loading('Đang đóng gói file ZIP theo từng thư mục ao...', { id: 'export-toast' });
      await exportCycleToZip(cycle, allReports);
      toast.success(`Đã tải xuống gói báo cáo toàn vụ (${cycle.totals.totalPondsCount} ao) thành công!`, { id: 'export-toast' });
    } catch (err: any) {
      console.error('Export zip error:', err);
      toast.error(err?.message || 'Có lỗi xảy ra khi tạo gói zip báo cáo.', { id: 'export-toast' });
    } finally {
      setLoading(false);
      setDownloadingFormat(null);
    }
  };

  // Xử lý xuất file theo định dạng cho từng ao
  const handleExportSinglePond = async (format: ExportFormat) => {
    if (!currentCrop) return;
    if (currentCrop.status !== 'HARVESTED') {
      toast.error(`Ao nuôi ${currentCrop.pond?.name} chưa thu hoạch nên chưa thể tải file báo cáo!`, { id: 'export-toast' });
      return;
    }

    setDownloadingFormat(format);
    setLoading(true);
    try {
      toast.loading(`Đang lấy dữ liệu báo cáo ao ${currentCrop.pond?.name}...`, { id: 'export-toast' });
      const report = await fetchDetailedReport(currentCrop.id);

      if (format === 'xlsx') {
        toast.loading('Đang tạo bảng tính Excel đa trang tính...', { id: 'export-toast' });
        exportCropToExcel(report, cycle);
        toast.success(`Đã tải xuống file Excel báo cáo ao ${currentCrop.pond?.name}!`, { id: 'export-toast' });
      } else if (format === 'docx') {
        toast.loading('Đang biên tập văn bản Word Docs chuẩn...', { id: 'export-toast' });
        await exportCropToDocx(report, cycle);
        toast.success(`Đã tải xuống tài liệu Word báo cáo ao ${currentCrop.pond?.name}!`, { id: 'export-toast' });
      } else if (format === 'pdf_print') {
        toast.dismiss('export-toast');
        exportCropToPdfPrint(report, cycle);
      } else if (format === 'pdf') {
        toast.loading('Đang tạo file PDF báo cáo...', { id: 'export-toast' });
        exportCropToDirectPdf(report, cycle);
        toast.success(`Đã tải xuống file PDF báo cáo ao ${currentCrop.pond?.name}!`, { id: 'export-toast' });
      }
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err?.message || 'Có lỗi xảy ra khi tạo file báo cáo. Vui lòng thử lại!', { id: 'export-toast' });
    } finally {
      setLoading(false);
      setDownloadingFormat(null);
    }
  };

  // Tải trọn bộ cả 3 định dạng cho ao đơn lẻ
  const handleExportAllSinglePond = async () => {
    if (!currentCrop) return;
    if (currentCrop.status !== 'HARVESTED') {
      toast.error(`Ao nuôi ${currentCrop.pond?.name} chưa thu hoạch!`, { id: 'export-toast' });
      return;
    }

    setDownloadingFormat('all');
    setLoading(true);
    try {
      toast.loading(`Đang tổng hợp dữ liệu báo cáo ao ${currentCrop.pond?.name}...`, { id: 'export-toast' });
      const report = await fetchDetailedReport(currentCrop.id);

      toast.loading('1/3: Đang tải file Excel (.xlsx)...', { id: 'export-toast' });
      exportCropToExcel(report, cycle);

      await new Promise((r) => setTimeout(r, 800));
      toast.loading('2/3: Đang tải file Word (.docx)...', { id: 'export-toast' });
      await exportCropToDocx(report, cycle);

      await new Promise((r) => setTimeout(r, 800));
      toast.loading('3/3: Đang tải file PDF (.pdf)...', { id: 'export-toast' });
      exportCropToDirectPdf(report, cycle);

      toast.success(`Đã tải thành công trọn bộ 3 định dạng báo cáo ao ${currentCrop.pond?.name}!`, { id: 'export-toast' });
    } catch (err: any) {
      console.error('Export all error:', err);
      toast.error(err?.message || 'Không thể tải trọn bộ báo cáo. Vui lòng thử tải từng định dạng!', { id: 'export-toast' });
    } finally {
      setLoading(false);
      setDownloadingFormat(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col relative max-h-[95vh]">
        {/* Top Gradient Stripe */}
        <div className="h-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 shrink-0" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              {isFullCycleMode ? <Archive className="w-6 h-6" /> : <FileDown className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {isFullCycleMode ? 'Tải Toàn Bộ Báo Cáo Vụ Nuôi' : 'Tải Báo Cáo Ao Nuôi'}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isTargetHarvested
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  {isTargetHarvested ? '✓ Đã thu hoạch' : '🟢 Đang nuôi (Chưa thu hoạch)'}
                </span>
                {isFullCycleMode && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                    <Archive className="w-3 h-3 text-indigo-600" /> Gói nén ZIP ({cycle?.totals.totalPondsCount} ao)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-700 font-semibold">{cycleTitle}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" /> {farmName}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Cảnh báo nếu vụ / ao chưa thu hoạch */}
          {!isTargetHarvested && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3 text-amber-900 animate-in fade-in duration-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-black text-amber-900">
                  {isFullCycleMode
                    ? 'Vụ nuôi này đang trong quá trình nuôi, chưa hoàn thành thu hoạch!'
                    : `Ao nuôi ${currentCrop?.pond?.name} đang nuôi, chưa hoàn tất thu hoạch!`}
                </p>
                <p className="text-amber-700 leading-relaxed font-medium">
                  Theo quy định của hệ thống, chỉ các vụ nuôi hoặc ao nuôi đã hoàn thành thu hoạch và nghiệm thu số liệu mới có thể kết toán và tải file báo cáo (PDF, Word, Excel, ZIP).
                </p>
              </div>
            </div>
          )}

          {/* Lựa chọn phạm vi: Toàn bộ vụ (ZIP) hoặc Từng ao riêng lẻ */}
          {cycle && availableCrops.length > 1 && (
            <div className="p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 rounded-2xl border border-blue-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Waves className="w-4 h-4 text-blue-600" />
                  Chọn phạm vi báo cáo ({availableCrops.length} ao tham gia vụ):
                </label>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/90 px-2.5 py-0.5 rounded-full">
                  {selectedPond === 'ALL'
                    ? '📦 Đang chọn: Toàn bộ vụ (File ZIP)'
                    : `Ao: ${currentCrop?.pond?.name || ''}`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Nút Chọn Toàn Bộ Vụ */}
                <button
                  type="button"
                  onClick={() => setSelectedPond('ALL')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left border flex items-center justify-between cursor-pointer col-span-2 sm:col-span-1 ${
                    selectedPond === 'ALL'
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400/40'
                      : 'bg-white text-indigo-900 hover:bg-indigo-100/60 border-indigo-200 font-semibold'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Archive className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Toàn bộ vụ ({availableCrops.length} ao - ZIP)</span>
                  </span>
                </button>

                {/* Các nút từng ao riêng lẻ */}
                {availableCrops.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedPond(c.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left border flex items-center justify-between cursor-pointer ${
                      selectedPond === c.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-400/40'
                        : 'bg-white text-slate-700 hover:bg-slate-100/80 border-slate-200'
                    }`}
                  >
                    <span className="truncate">{c.pond?.name || 'Ao nuôi'}</span>
                    {c.stage === 'NURSERY' && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-normal shrink-0 ${
                          selectedPond === c.id ? 'bg-blue-700 text-white' : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        Ương
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Thẻ tóm tắt thông số phạm vi đang chọn */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
            <div className="p-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">
                {isFullCycleMode ? 'Phạm vi xuất' : 'Ao thực hiện'}
              </span>
              <span className="text-sm font-black text-slate-800 truncate block">
                {isFullCycleMode
                  ? `Toàn bộ vụ (${cycle?.totals.totalPondsCount || availableCrops.length} ao)`
                  : currentCrop?.pond?.name || '--'}
              </span>
            </div>
            <div className="p-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">
                {isFullCycleMode ? 'Tổng sản lượng' : 'Sản lượng'}
              </span>
              <span className="text-sm font-black text-blue-600">
                {isFullCycleMode
                  ? `${formatNumber(cycle?.totals.totalHarvestKg, 1)} kg`
                  : currentCrop?.actualHarvestKg
                  ? `${formatNumber(currentCrop.actualHarvestKg, 1)} kg`
                  : 'Đang nuôi'}
              </span>
            </div>
            <div className="p-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">
                {isFullCycleMode ? 'Tỷ lệ sống TB' : 'Tỷ lệ sống'}
              </span>
              <span className="text-sm font-black text-emerald-600">
                {isFullCycleMode
                  ? cycle?.totals.overallSurvivalRate !== null && cycle?.totals.overallSurvivalRate !== undefined
                    ? `${cycle.totals.overallSurvivalRate}%`
                    : '--'
                  : currentCrop?.actualHarvestSurvivalRate
                  ? `${currentCrop.actualHarvestSurvivalRate}%`
                  : '--'}
              </span>
            </div>
            <div className="p-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">
                {isFullCycleMode ? 'Tổng lợi nhuận ròng' : 'Lợi nhuận ròng'}
              </span>
              <span
                className={`text-sm font-black ${
                  (isFullCycleMode ? cycle?.totals.totalProfit || 0 : currentCrop?.actualHarvestProfit || 0) >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                }`}
              >
                {isFullCycleMode
                  ? formatVND(cycle?.totals.totalProfit)
                  : formatVND(currentCrop?.actualHarvestProfit)}
              </span>
            </div>
          </div>

          {/* ── GIAO DIỆN KHI CHỌN TOÀN BỘ VỤ NUÔI (GÓI ZIP TỪNG AO) ────────── */}
          {isFullCycleMode ? (
            <div className="space-y-4">
              <div className="p-5 bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-purple-50/60 rounded-3xl border-2 border-indigo-200 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/30 shrink-0">
                      <Archive className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-base">
                          Tải Toàn Bộ Báo Cáo Vụ Nuôi (Gói ZIP Thư Mục)
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white">
                          .ZIP
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Hệ thống sẽ tổng hợp tất cả các file liên quan của từng ao trong vụ và gom lại thành 1 file ZIP duy nhất. Sau khi giải nén, mỗi ao sẽ là một thư mục con riêng biệt chứa đầy đủ 3 định dạng: <strong>PDF</strong>, <strong>Word</strong> và <strong>Excel</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sơ đồ cây thư mục khi giải nén */}
                <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-indigo-100 font-mono text-xs text-slate-800 space-y-2 shadow-inner">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold font-sans">
                    <FolderTree className="w-4 h-4 text-indigo-600" />
                    <span>Cấu trúc thư mục sau khi giải nén file ZIP:</span>
                  </div>
                  <div className="pl-2 space-y-1.5 text-[11.5px] text-slate-700">
                    <div className="flex items-center gap-2 text-indigo-700 font-bold">
                      <Archive className="w-3.5 h-3.5" />
                      <span>BaoCao_ToanVu_{cycle?.name || 'VuNuoi'}.zip</span>
                    </div>
                    {availableCrops.map((c) => {
                      const isNursery = c.stage === 'NURSERY';
                      const folderName = isNursery && !c.pond?.name?.toLowerCase().includes('ươm')
                        ? `${c.pond?.name} (Ao ươm)`
                        : c.pond?.name || 'Ao nuôi';
                      return (
                        <div key={c.id} className="pl-5 border-l-2 border-indigo-200 space-y-1 py-0.5">
                          <div className="flex items-center gap-2 font-bold text-slate-900">
                            <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                            <span>{folderName}/</span>
                          </div>
                          <div className="pl-6 space-y-0.5 text-slate-500 text-[11px] font-sans">
                            <div className="flex items-center gap-1.5">
                              <span className="text-rose-600 font-bold text-[10px]">[PDF]</span>
                              <span>Báo cáo chuẩn in ấn A4 & nghiệm thu</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-blue-600 font-bold text-[10px]">[DOCX]</span>
                              <span>Tài liệu Word chi tiết có thể biên tập</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-600 font-bold text-[10px]">[XLSX]</span>
                              <span>Bảng tính Excel 7 trang tính (Chi phí, Cho ăn, Nước...)</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── GIAO DIỆN KHI CHỌN TỪNG AO RIÊNG LẺ ──────────────────────── */
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Chọn định dạng file báo cáo ao {currentCrop?.pond?.name}:</span>
                <span className="text-[11px] text-blue-600 font-semibold normal-case">
                  Tự động lưu vào thư mục Downloads của bạn
                </span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Option 1: PDF */}
                <div
                  onClick={() => setSelectedFormat('pdf')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between group relative ${
                    selectedFormat === 'pdf'
                      ? 'border-rose-500 bg-rose-50/40 shadow-md shadow-rose-500/10'
                      : 'border-slate-200 hover:border-rose-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                        .PDF
                      </span>
                    </div>
                    <h5 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-rose-600 transition-colors">
                      Báo cáo PDF
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Trình bày trang trọng, biểu đồ KPI trực quan, chuẩn khổ in A4 kèm khung chữ ký nghiệm thu.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-600">
                    <span>Trình ký & In ấn</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedFormat === 'pdf' ? 'border-rose-600 bg-rose-600' : 'border-slate-300'
                      }`}
                    >
                      {selectedFormat === 'pdf' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>

                {/* Option 2: DOCX (Word) */}
                <div
                  onClick={() => setSelectedFormat('docx')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between group relative ${
                    selectedFormat === 'docx'
                      ? 'border-blue-500 bg-blue-50/40 shadow-md shadow-blue-500/10'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                        .DOCX
                      </span>
                    </div>
                    <h5 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-blue-600 transition-colors">
                      Tài liệu Docs (Word)
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      File văn bản chuẩn Microsoft Word, đầy đủ các mục chi tiết, dễ dàng chỉnh sửa hoặc bổ sung ý kiến.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                    <span>Có thể chỉnh sửa</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedFormat === 'docx' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                      }`}
                    >
                      {selectedFormat === 'docx' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>

                {/* Option 3: EXCEL (XLSX) */}
                <div
                  onClick={() => setSelectedFormat('xlsx')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between group relative ${
                    selectedFormat === 'xlsx'
                      ? 'border-emerald-500 bg-emerald-50/40 shadow-md shadow-emerald-500/10'
                      : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                        .XLSX
                      </span>
                    </div>
                    <h5 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-emerald-600 transition-colors">
                      Bảng tính Excel
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Đa trang tính (7 Sheets): Tổng quan, Chi phí, Cho ăn, Nước, Tăng trưởng, Thuốc/Men và Sự cố.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                    <span>Phân tích dữ liệu</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedFormat === 'xlsx' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                      }`}
                    >
                      {selectedFormat === 'xlsx' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tùy chọn in ấn trực tiếp nếu chọn PDF */}
              {selectedFormat === 'pdf' && (
                <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-rose-800">
                    <Printer className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Bạn muốn mở bản in xem trước và lưu PDF vector chuẩn A4?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportSinglePond('pdf_print')}
                    disabled={loading || !isTargetHarvested}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Mở bản in A4
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onOpenDetailedPreview && !isFullCycleMode && currentCrop && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDetailedPreview(currentCrop);
                }}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
              >
                <ExternalLink className="w-4 h-4 text-slate-500" />
                Xem trước trên web
              </button>
            )}

            {!isFullCycleMode && (
              <button
                type="button"
                onClick={handleExportAllSinglePond}
                disabled={loading || !isTargetHarvested}
                className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                title="Tải liên tiếp 3 file: PDF, Word và Excel của ao này"
              >
                {downloadingFormat === 'all' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <Layers className="w-4 h-4 text-indigo-600" />
                )}
                Tải trọn bộ 3 file ao này
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer w-full sm:w-auto"
            >
              Hủy
            </button>

            {isFullCycleMode ? (
              /* Nút Tải Toàn Bộ Vụ (ZIP) */
              <button
                type="button"
                onClick={handleExportZip}
                disabled={loading || !isTargetHarvested}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 w-full sm:w-auto ${
                  !isTargetHarvested
                    ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-600/25 cursor-pointer hover:scale-102'
                }`}
              >
                {loading && downloadingFormat === 'zip' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !isTargetHarvested ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                <span>
                  {!isTargetHarvested
                    ? 'Chưa thể tải (Vụ chưa thu hoạch)'
                    : `Tải toàn bộ báo cáo vụ (.zip)`}
                </span>
              </button>
            ) : (
              /* Nút Tải Từng Ao */
              <button
                type="button"
                onClick={() => handleExportSinglePond(selectedFormat)}
                disabled={loading || !isTargetHarvested}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 w-full sm:w-auto ${
                  !isTargetHarvested
                    ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                    : selectedFormat === 'pdf'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 cursor-pointer'
                    : selectedFormat === 'docx'
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 cursor-pointer'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 cursor-pointer'
                }`}
              >
                {loading && downloadingFormat === selectedFormat ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !isTargetHarvested ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                <span>
                  {!isTargetHarvested
                    ? 'Chưa thể tải (Ao chưa thu hoạch)'
                    : selectedFormat === 'pdf'
                    ? `Tải file PDF ao ${currentCrop?.pond?.name || ''} (.pdf)`
                    : selectedFormat === 'docx'
                    ? `Tải file Word ao ${currentCrop?.pond?.name || ''} (.docx)`
                    : `Tải file Excel ao ${currentCrop?.pond?.name || ''} (.xlsx)`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
