import React, { useState, useEffectEvent } from 'react';
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
  Folder,
  Lock,
  AlertTriangle,
  ArrowLeft,
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
import { scrollToTop } from '../utils/scrollHelper';
import { getErrorMessage } from '../utils/errors';

interface CropReportExportModalProps {
  isOpen: boolean;
  crop?: Crop | null;
  cycle?: CropCycle | null;
  onClose: () => void;
  onOpenDetailedPreview?: (crop: Crop) => void;
  /** Hiển thị như một trang riêng (thay vì hộp thoại nổi) */
  asPage?: boolean;
}

type ExportFormat = 'pdf' | 'docx' | 'xlsx' | 'pdf_print';
type PondSelection = 'ALL' | string;

export default function CropReportExportModal({
  isOpen,
  crop: initialCrop,
  cycle,
  onClose,
  onOpenDetailedPreview,
  asPage = false,
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
  const syncSelectedPond = useEffectEvent(() => {
    if (cycle && cycle.allCrops && cycle.allCrops.length > 1) {
      setSelectedPond('ALL');
    } else if (initialCrop?.id) {
      setSelectedPond(initialCrop.id);
    } else if (availableCrops[0]?.id) {
      setSelectedPond(availableCrops[0].id);
    }
  });
  React.useEffect(() => {
    syncSelectedPond();
  }, [initialCrop, cycle]);

  React.useEffect(() => {
    if (isOpen && asPage) {
      scrollToTop();
    }
  }, [isOpen, asPage]);

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
    } catch (err) {
      console.error('Export zip error:', err);
      toast.error(getErrorMessage(err) || 'Có lỗi xảy ra khi tạo gói zip báo cáo.', { id: 'export-toast' });
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
    } catch (err) {
      console.error('Export error:', err);
      toast.error(getErrorMessage(err) || 'Có lỗi xảy ra khi tạo file báo cáo. Vui lòng thử lại!', { id: 'export-toast' });
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
    } catch (err) {
      console.error('Export all error:', err);
      toast.error(getErrorMessage(err) || 'Không thể tải trọn bộ báo cáo. Vui lòng thử tải từng định dạng!', { id: 'export-toast' });
    } finally {
      setLoading(false);
      setDownloadingFormat(null);
    }
  };

  const formats: {
    id: Exclude<ExportFormat, 'pdf_print'>;
    name: string;
    ext: string;
    desc: string;
    icon: typeof FileText;
    tone: string;
  }[] = [
    { id: 'pdf', name: 'PDF', ext: '.pdf', desc: 'Bản trình ký, khổ A4, có khung chữ ký nghiệm thu', icon: FileText, tone: 'text-rose-600 bg-rose-50' },
    { id: 'docx', name: 'Word', ext: '.docx', desc: 'Văn bản đầy đủ các mục, chỉnh sửa được', icon: FileText, tone: 'text-blue-600 bg-blue-50' },
    { id: 'xlsx', name: 'Excel', ext: '.xlsx', desc: '7 trang tính: tổng quan, chi phí, cho ăn, nước, tăng trưởng, thuốc, sự cố', icon: FileSpreadsheet, tone: 'text-emerald-600 bg-emerald-50' },
  ];
  const selectedFormatInfo = formats.find((f) => f.id === selectedFormat) || formats[0];
  const pondsCount = cycle?.totals.totalPondsCount || availableCrops.length;

  const summary = [
    {
      label: isFullCycleMode ? 'Phạm vi' : 'Ao',
      value: isFullCycleMode ? `Toàn vụ · ${pondsCount} ao` : currentCrop?.pond?.name || '—',
    },
    {
      label: 'Sản lượng',
      value: isFullCycleMode
        ? `${formatNumber(cycle?.totals.totalHarvestKg, 1)} kg`
        : currentCrop?.actualHarvestKg
        ? `${formatNumber(currentCrop.actualHarvestKg, 1)} kg`
        : '—',
    },
    {
      label: 'Tỷ lệ sống',
      value: isFullCycleMode
        ? cycle?.totals.overallSurvivalRate != null
          ? `${cycle.totals.overallSurvivalRate}%`
          : '—'
        : currentCrop?.actualHarvestSurvivalRate
        ? `${currentCrop.actualHarvestSurvivalRate}%`
        : '—',
    },
    {
      label: 'Lợi nhuận',
      value: formatVND(isFullCycleMode ? cycle?.totals.totalProfit : currentCrop?.actualHarvestProfit),
      negative: (isFullCycleMode ? cycle?.totals.totalProfit || 0 : currentCrop?.actualHarvestProfit || 0) < 0,
    },
  ];

  const primaryLabel = !isTargetHarvested
    ? 'Chưa thu hoạch'
    : isFullCycleMode
    ? 'Tải gói ZIP'
    : `Tải ${selectedFormatInfo.name}`;
  const primaryBusy = loading && (isFullCycleMode ? downloadingFormat === 'zip' : downloadingFormat === selectedFormat);

  const content = (
    <div
      className={`bg-white w-full border border-slate-200 overflow-hidden flex flex-col ${
        asPage ? 'rounded-2xl' : 'rounded-2xl max-w-3xl shadow-2xl max-h-[95vh]'
      }`}
    >
      {/* ── Tiêu đề ── */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {asPage && (
            <button
              onClick={onClose}
              disabled={loading}
              title="Quay lại"
              aria-label="Quay lại"
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Tải báo cáo</h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${
                  isTargetHarvested ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isTargetHarvested ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isTargetHarvested ? 'Đã thu hoạch' : 'Đang nuôi'}
              </span>
            </div>
            <p className="text-sm text-slate-500 truncate flex items-center gap-1">
              {cycleTitle} <span className="text-slate-300">·</span> <Building2 className="w-3.5 h-3.5" /> {farmName}
            </p>
          </div>
        </div>
        {!asPage && (
          <button
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng"
            className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Nội dung ── */}
      <div className={`p-5 space-y-5 ${asPage ? '' : 'overflow-y-auto flex-1'}`}>
        {!isTargetHarvested && (
          <div className="px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {isFullCycleMode ? 'Vụ nuôi' : `Ao ${currentCrop?.pond?.name}`} chưa thu hoạch xong — chỉ tải được báo cáo sau khi thu hoạch và nghiệm thu.
            </span>
          </div>
        )}

        {/* Bước 1: Phạm vi */}
        {cycle && availableCrops.length > 1 && (
          <section className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Phạm vi báo cáo</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedPond('ALL')}
                aria-pressed={selectedPond === 'ALL'}
                className={`h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                  selectedPond === 'ALL'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Archive className="w-4 h-4" /> Toàn vụ ({availableCrops.length} ao)
              </button>
              {availableCrops.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedPond(c.id)}
                  aria-pressed={selectedPond === c.id}
                  className={`h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                    selectedPond === c.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Waves className="w-4 h-4" /> {c.pond?.name || 'Ao nuôi'}
                  {c.stage === 'NURSERY' && <span className="text-xs text-slate-400">· ương</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Tóm tắt số liệu */}
        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {summary.map((m) => (
            <div key={m.label} className="px-4 py-3">
              <p className="text-xs text-slate-500">{m.label}</p>
              <p className={`text-sm font-semibold tabular-nums truncate ${m.negative ? 'text-rose-600' : 'text-slate-900'}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Bước 2: Định dạng */}
        {isFullCycleMode ? (
          <section className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Nội dung gói ZIP</p>
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-slate-900">
                    BaoCao_ToanVu_{cycle?.name || 'VuNuoi'}.zip
                  </p>
                  <p className="text-slate-500">Mỗi ao là một thư mục, gồm đủ 3 file PDF, Word và Excel.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-[52px]">
                {availableCrops.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">
                    <Folder className="w-3.5 h-3.5 text-amber-500" />
                    {c.pond?.name || 'Ao nuôi'}
                    {c.stage === 'NURSERY' ? ' (ương)' : ''}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Định dạng file</p>
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-200 overflow-hidden" role="radiogroup">
              {formats.map((f) => {
                const active = selectedFormat === f.id;
                return (
                  <label
                    key={f.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${active ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <input
                      type="radio"
                      name="report-format"
                      checked={active}
                      onChange={() => setSelectedFormat(f.id)}
                      className="w-4 h-4 accent-blue-600 shrink-0"
                    />
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${f.tone}`}>
                      <f.icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">
                        {f.name} <span className="text-xs font-normal text-slate-400">{f.ext}</span>
                      </span>
                      <span className="block text-xs text-slate-500 truncate">{f.desc}</span>
                    </span>
                    {f.id === 'pdf' && active && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          void handleExportSinglePond('pdf_print');
                        }}
                        disabled={loading || !isTargetHarvested}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                        title="Mở bản in A4 để xem trước hoặc lưu PDF"
                      >
                        <Printer className="w-3.5 h-3.5" /> Bản in A4
                      </button>
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* ── Thao tác ── */}
      <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {onOpenDetailedPreview && !isFullCycleMode && currentCrop && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDetailedPreview(currentCrop);
              }}
              className="h-9 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200/60 flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" /> Xem trước
            </button>
          )}
          {!isFullCycleMode && (
            <button
              type="button"
              onClick={handleExportAllSinglePond}
              disabled={loading || !isTargetHarvested}
              title="Tải lần lượt PDF, Word và Excel của ao này"
              className="h-9 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200/60 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingFormat === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Tải cả 3 định dạng
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {asPage ? 'Quay lại' : 'Hủy'}
          </button>
          <button
            type="button"
            onClick={() => (isFullCycleMode ? void handleExportZip() : void handleExportSinglePond(selectedFormat))}
            disabled={loading || !isTargetHarvested}
            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {primaryBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : !isTargetHarvested ? (
              <Lock className="w-4 h-4" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (asPage) {
    return <div className="w-full pb-12">{content}</div>;
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      {content}
    </div>,
    document.body,
  );
}
