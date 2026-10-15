/**
 * CreateShrimpHealth.tsx
 *
 * Kiểm tra & Ghi nhận sức khỏe tôm theo luồng tối ưu:
 * 1. Tôm khỏe mạnh / Bình thường: Lưu nhật ký kiểm tra định kỳ.
 * 2. Bất thường / Có dấu hiệu bệnh: Tự động tạo sự cố và chuyển sang Sự cố & Điều trị.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  HeartPulse,
  Activity,
  Percent,
  Building2,
  Waves,
  Layers,
  Calendar,
  FileText,
  Stethoscope,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { pondService } from '../../services/pond.service';
import { cropService, type Crop } from '../../services/crop.service';
import { shrimpHealthService } from '../../services/shrimp-health.service';
import { incidentService } from '../../services/incident.service';
import LoadingMotion from '../../components/LoadingMotion';
import type {
  ShrimpHealthStatusType,
  ShrimpSeverityType,
} from '../../services/shrimp-health.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

interface CreateShrimpHealthProps {
  onNavigateToIncident?: (incidentId?: string, targetTab?: 'incident' | 'treatment') => void;
  onNavigateToHistory?: () => void;
  isFarmer?: boolean;
}

// ─── Danh mục triệu chứng thường gặp ──────────────────────────────────────────

const COMMON_SYMPTOMS: { id: string; label: string; defaultStatus: ShrimpHealthStatusType }[] = [
  { id: 'tap_me', label: 'Tấp mé bờ', defaultStatus: 'EDGE_GATHERING' },
  { id: 'lo_do', label: 'Lờ đờ, bơi yếu', defaultStatus: 'LETHARGIC' },
  { id: 'bo_an', label: 'Bỏ ăn / Ăn kém', defaultStatus: 'LOSS_OF_APPETITE' },
  { id: 'phan_trang', label: 'Phân trắng / Ruột trống', defaultStatus: 'LOSS_OF_APPETITE' },
  { id: 'dom_trang', label: 'Đốm trắng / Đỏ thân', defaultStatus: 'LETHARGIC' },
  { id: 'den_mang', label: 'Đen mang / Vàng mang', defaultStatus: 'LETHARGIC' },
  { id: 'duc_co', label: 'Đục cơ / Cong thân', defaultStatus: 'LETHARGIC' },
  { id: 'teo_gan', label: 'Gan tụy teo / Nhạt màu', defaultStatus: 'LOSS_OF_APPETITE' },
  { id: 'mem_vo', label: 'Mềm vỏ / Chậm lớn', defaultStatus: 'LETHARGIC' },
];

const SEVERITY_OPTIONS: { value: ShrimpSeverityType; label: string; desc: string; color: string }[] = [
  { value: 'MILD', label: 'Nhẹ', desc: 'Dưới 15% đàn tôm có biểu hiện, tôm vẫn ăn', color: 'border-amber-200 bg-amber-50 text-amber-800' },
  { value: 'MODERATE', label: 'Trung bình', desc: '15% - 40% đàn tôm bị ảnh hưởng, sức ăn giảm rõ', color: 'border-orange-200 bg-orange-50 text-orange-800' },
  { value: 'SEVERE', label: 'Nặng / Nguy hiểm', desc: 'Trên 40% đàn tôm tấp mé, bỏ ăn, cần cấp cứu ngay', color: 'border-rose-200 bg-rose-50 text-rose-800' },
];

// ─── Toast Component ──────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

function Toast({ message, type, actionLabel, onAction }: ToastProps) {
  return (
    <div
      className={`fixed top-6 right-6 z-[250] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-semibold animate-in slide-in-from-right-8 fade-in duration-300 max-w-md ${
        type === 'success'
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-500/10'
          : 'bg-red-50 border-red-300 text-red-900 shadow-red-500/10'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      )}
      <div className="flex-1 leading-snug">{message}</div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="ml-2 px-3 py-1 text-xs font-black rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors shadow-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateShrimpHealth({
  onNavigateToIncident,
  onNavigateToHistory,
  isFarmer = false,
}: CreateShrimpHealthProps) {
  // ── Master data state ───────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  // ── Selection state ─────────────────────────────────────────────────────────
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [selectedCropId, setSelectedCropId] = useState('');
  const [recordTime, setRecordTime] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // ── Health condition branch: 'NORMAL' vs 'ABNORMAL' ─────────────────────────
  const [healthCondition, setHealthCondition] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');

  // ── Case 1: Tôm bình thường ─────────────────────────────────────────────────
  const [normalNote, setNormalNote] = useState('');

  // ── Case 2: Tôm bất thường -> chuyển sang sự cố điều trị ───────────────────
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [severity, setSeverity] = useState<ShrimpSeverityType>('MODERATE');
  const [affectedPercentage, setAffectedPercentage] = useState('15');

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(true);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Filtered ponds ───────────────────────────────────────────────────────────
  const filteredPonds = selectedFarmId
    ? ponds.filter((p) => p.farmId === selectedFarmId)
    : ponds;

  // ── Load farms & ponds ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { farms: farmsData, ponds: pondsData } = await pondService.getOverview();
        setFarms(farmsData || []);
        setPonds(pondsData || []);
        if (farmsData?.length === 1) {
          setSelectedFarmId(farmsData[0].id);
        }
      } catch {
        showToast('Không thể tải danh sách trang trại và ao nuôi', 'error');
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  // ── Load active crops when pond changes ──────────────────────────────────────
  useEffect(() => {
    if (!selectedPondId) {
      setCrops([]);
      setSelectedCropId('');
      return;
    }
    (async () => {
      setLoadingCrops(true);
      setSelectedCropId('');
      try {
        const data = await cropService.getByPond(selectedPondId, 'ACTIVE');
        setCrops(data || []);
        if (data?.length === 1) {
          setSelectedCropId(data[0].id);
        }
      } catch {
        showToast('Không thể tải danh sách vụ nuôi đang hoạt động', 'error');
        setCrops([]);
      } finally {
        setLoadingCrops(false);
      }
    })();
  }, [selectedPondId]);

  // ── Auto update incident title when symptoms change (if user hasn't edited) ─
  const updateIncidentTitleAndDesc = (symptoms: string[], custom: string) => {
    const pondName = ponds.find((p) => p.id === selectedPondId)?.name || 'ao nuôi';
    const allLabels = [...symptoms];
    if (custom.trim()) allLabels.push(custom.trim());

    if (allLabels.length > 0) {
      const generatedTitle = `Sự cố sức khỏe tôm ${pondName}: ${allLabels.join(', ')}`;
      setIncidentTitle(generatedTitle);

      const generatedDesc = `Kiểm tra định kỳ phát hiện tôm tại ${pondName} có dấu hiệu: ${allLabels.join(
        ', '
      )}. Tỷ lệ ảnh hưởng ước tính ${affectedPercentage}%. Cần kiểm tra phác đồ điều trị và xuất vật tư phù hợp.`;
      setIncidentDescription(generatedDesc);
    }
  };

  const toggleSymptom = (label: string) => {
    const exists = selectedSymptoms.includes(label);
    const updated = exists
      ? selectedSymptoms.filter((s) => s !== label)
      : [...selectedSymptoms, label];
    setSelectedSymptoms(updated);
    updateIncidentTitleAndDesc(updated, customSymptom);
    setErrors((prev) => ({ ...prev, symptoms: '', incidentTitle: '' }));
  };

  const showToast = (
    message: string,
    type: 'success' | 'error',
    actionLabel?: string,
    onAction?: () => void
  ) => {
    setToast({ message, type, actionLabel, onAction });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedFarmId) newErrors.farm = 'Vui lòng chọn trang trại';
    if (!selectedPondId) newErrors.pond = 'Vui lòng chọn ao nuôi';
    if (!selectedCropId) newErrors.crop = 'Vui lòng chọn vụ nuôi đang hoạt động';

    const rt = new Date(recordTime);
    if (rt > new Date(Date.now() + 60000)) {
      newErrors.recordTime = 'Thời gian ghi nhận không được ở tương lai';
    }

    if (healthCondition === 'ABNORMAL') {
      if (selectedSymptoms.length === 0 && !customSymptom.trim()) {
        newErrors.symptoms = 'Vui lòng chọn ít nhất 1 triệu chứng hoặc nhập biểu hiện cụ thể';
      }
      if (!incidentTitle.trim()) {
        newErrors.incidentTitle = 'Vui lòng nhập tiêu đề sự cố cần điều trị';
      }
      const pct = parseFloat(affectedPercentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        newErrors.affectedPercentage = 'Tỷ lệ ảnh hưởng phải từ 0% đến 100%';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    selectedFarmId,
    selectedPondId,
    selectedCropId,
    recordTime,
    healthCondition,
    selectedSymptoms,
    customSymptom,
    incidentTitle,
    affectedPercentage,
  ]);

  // ── Submit logic ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const pondName = ponds.find((p) => p.id === selectedPondId)?.name || 'ao nuôi';

    try {
      if (healthCondition === 'NORMAL') {
        // ── NHÁNH 1: TÔM KHỎE MẠNH / BÌNH THƯỜNG ──────────────────────────────
        await shrimpHealthService.create({
          farmId: selectedFarmId,
          pondId: selectedPondId,
          cropId: selectedCropId,
          recordTime: new Date(recordTime).toISOString(),
          healthStatus: 'NORMAL',
          severity: 'NORMAL',
          affectedPercentage: 0,
          note: normalNote.trim() || 'Tôm phát triển bình thường, khỏe mạnh, ruột đầy, ăn đều.',
        });

        showToast(
          `Đã ghi nhận tôm ao ${pondName} phát triển bình thường vào nhật ký định kỳ!`,
          'success',
          'Xem nhật ký',
          () => onNavigateToHistory?.()
        );

        // Reset form ghi chú
        setNormalNote('');
      } else {
        // ── NHÁNH 2: TÔM BẤT THƯỜNG -> TẠO SỰ CỐ ĐIỀU TRỊ ────────────────────
        // 1. Xác định health status chính dựa vào triệu chứng
        let healthStatus: ShrimpHealthStatusType = 'LETHARGIC';
        if (selectedSymptoms.some((s) => s.includes('Tấp mé'))) {
          healthStatus = 'EDGE_GATHERING';
        } else if (selectedSymptoms.some((s) => s.includes('Bỏ ăn') || s.includes('Phân trắng'))) {
          healthStatus = 'LOSS_OF_APPETITE';
        }

        // 2. Tạo bản ghi Incident (Sự cố cần điều trị)
        const finalTitle = incidentTitle.trim() || `Sự cố sức khỏe tôm ${pondName}`;
        const finalDescription =
          incidentDescription.trim() ||
          `Phát hiện tôm có triệu chứng: ${selectedSymptoms.join(', ')}. Tỷ lệ ảnh hưởng: ${affectedPercentage}%. Mức độ: ${severity}.`;

        const newIncident = await incidentService.create({
          cropId: selectedCropId,
          title: finalTitle,
          description: finalDescription,
        });

        // Tự động kích hoạt bắt đầu điều trị để chuyển sự cố sang TREATING (Quá trình điều trị)
        try {
          await incidentService.startTreatment(newIncident.id);
        } catch (startErr) {
          console.warn('Tự động bắt đầu điều trị:', startErr);
        }

        // 3. Đồng thời lưu bản ghi ShrimpHealthRecord để giữ telemetry đồng bộ
        try {
          await shrimpHealthService.create({
            farmId: selectedFarmId,
            pondId: selectedPondId,
            cropId: selectedCropId,
            recordTime: new Date(recordTime).toISOString(),
            healthStatus,
            severity,
            affectedPercentage: parseFloat(affectedPercentage) || 15,
            note: `[SỰ CỐ ĐIỀU TRỊ] ${finalTitle}: ${finalDescription}`,
          });
        } catch (subErr) {
          console.warn('Ghi log sức khỏe phụ thất bại (sự cố đã tạo thành công):', subErr);
        }

        showToast(
          `Đã phát hiện bệnh tại ${pondName}! Đang chuyển thẳng sang Quá trình điều trị & Kê đơn thuốc...`,
          'success'
        );

        // Tự động chuyển người dùng sang đúng không gian "Quá trình điều trị" của sự cố vừa tạo
        setTimeout(() => {
          onNavigateToIncident?.(newIncident?.id, 'treatment');
        }, 500);
      }
    } catch (err: any) {
      showToast(err.message || 'Không thể lưu bản ghi. Vui lòng kiểm tra lại.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedPondId('');
    setSelectedCropId('');
    setCrops([]);
    setNormalNote('');
    setSelectedSymptoms([]);
    setCustomSymptom('');
    setIncidentTitle('');
    setIncidentDescription('');
    setErrors({});
  };

  const formatCropLabel = (crop: Crop) => {
    const d = new Date(crop.startDate);
    return `Vụ ${d.toLocaleDateString('vi-VN')} — ${crop.initialShrimpCount.toLocaleString()} con (${
      crop.stage === 'NURSERY' ? 'Ương' : 'Thương phẩm'
    })`;
  };

  // ── Render Loading ───────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <LoadingMotion
        mode="card"
        title="Đang tải dữ liệu kiểm tra sức khỏe..."
        subtitle="Hệ thống đang chuẩn bị danh sách ao nuôi, vụ nuôi và các danh mục kiểm tra..."
        icon={<HeartPulse className="w-10 h-10 text-indigo-600 animate-pulse" />}
        color="indigo"
      />
    );
  }

  const themeTextGradientHeader = isFarmer
    ? 'from-teal-700 to-emerald-500'
    : 'from-indigo-900 via-indigo-800 to-purple-600';
  const themeGradientHeader = isFarmer
    ? 'from-teal-500 to-emerald-400'
    : 'from-indigo-600 to-purple-500';
  const themeShadowHeader = isFarmer ? 'shadow-teal-500/30' : 'shadow-indigo-500/30';
  const themeFocusRing = isFarmer
    ? 'focus:border-teal-500 focus:ring-teal-500/20'
    : 'focus:border-indigo-500 focus:ring-indigo-500/20';

  return (
    <div className="max-w-[950px] mx-auto relative space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      )}

      {/* ── Page Header Banner ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 bg-gradient-to-br ${themeGradientHeader} rounded-2xl flex items-center justify-center text-white shadow-lg ${themeShadowHeader} flex-shrink-0`}
          >
            <HeartPulse className="w-7 h-7" />
          </div>
          <div>
            <h2
              className={`text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${themeTextGradientHeader} tracking-tight`}
            >
              Kiểm Tra & Ghi Nhận Sức Khỏe Tôm
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Kiểm tra định kỳ đàn tôm. Ghi nhận tôm khỏe mạnh hoặc phát hiện bất thường để chuyển ngay sang phác đồ điều trị.
            </p>
          </div>
        </div>
        {onNavigateToHistory && (
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            Nhật ký định kỳ
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* ── Section 1: Vị trí Ao & Thời gian kiểm tra ──────────────────────── */}
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">
              1
            </span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Vị trí Ao nuôi & Thời điểm kiểm tra
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Trang trại */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Trang trại <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedFarmId}
                  onChange={(e) => {
                    setSelectedFarmId(e.target.value);
                    setSelectedPondId('');
                    setSelectedCropId('');
                    setCrops([]);
                    setErrors((prev) => ({ ...prev, farm: '' }));
                  }}
                  className={`w-full px-3.5 py-2.5 pr-8 rounded-xl border text-xs font-semibold appearance-none outline-none transition-all cursor-pointer bg-slate-50/70 text-slate-800 ${
                    errors.farm ? 'border-rose-300 ring-2 ring-rose-500/10' : themeFocusRing
                  }`}
                >
                  <option value="">-- Chọn trang trại --</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {errors.farm && <p className="mt-1 text-[11px] text-rose-600 font-bold">{errors.farm}</p>}
            </div>

            {/* 2. Ao nuôi */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <Waves className="w-3.5 h-3.5 text-cyan-600" /> Ao nuôi <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedPondId}
                  onChange={(e) => {
                    setSelectedPondId(e.target.value);
                    setSelectedCropId('');
                    setErrors((prev) => ({ ...prev, pond: '' }));
                  }}
                  disabled={!selectedFarmId}
                  className={`w-full px-3.5 py-2.5 pr-8 rounded-xl border text-xs font-semibold appearance-none outline-none transition-all cursor-pointer bg-slate-50/70 text-slate-800 ${
                    !selectedFarmId
                      ? 'border-slate-100 bg-slate-100/50 text-slate-400 cursor-not-allowed'
                      : errors.pond
                      ? 'border-rose-300 ring-2 ring-rose-500/10'
                      : themeFocusRing
                  }`}
                >
                  <option value="">
                    {selectedFarmId ? '-- Chọn ao nuôi --' : '-- Chọn trang trại trước --'}
                  </option>
                  {filteredPonds.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {errors.pond && <p className="mt-1 text-[11px] text-rose-600 font-bold">{errors.pond}</p>}
            </div>

            {/* 3. Vụ nuôi */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" /> Vụ nuôi <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedCropId}
                  onChange={(e) => {
                    setSelectedCropId(e.target.value);
                    setErrors((prev) => ({ ...prev, crop: '' }));
                  }}
                  disabled={!selectedPondId || loadingCrops}
                  className={`w-full px-3.5 py-2.5 pr-8 rounded-xl border text-xs font-semibold appearance-none outline-none transition-all cursor-pointer bg-slate-50/70 text-slate-800 ${
                    !selectedPondId || loadingCrops
                      ? 'border-slate-100 bg-slate-100/50 text-slate-400 cursor-not-allowed'
                      : errors.crop
                      ? 'border-rose-300 ring-2 ring-rose-500/10'
                      : themeFocusRing
                  }`}
                >
                  <option value="">
                    {loadingCrops
                      ? 'Đang tải vụ nuôi...'
                      : !selectedPondId
                      ? '-- Chọn ao trước --'
                      : crops.length === 0
                      ? '-- Không có vụ đang nuôi --'
                      : '-- Chọn vụ nuôi --'}
                  </option>
                  {crops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCropLabel(c)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {errors.crop && <p className="mt-1 text-[11px] text-rose-600 font-bold">{errors.crop}</p>}
            </div>

            {/* 4. Thời gian kiểm tra */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Thời gian kiểm tra <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={recordTime}
                onChange={(e) => {
                  setRecordTime(e.target.value);
                  setErrors((prev) => ({ ...prev, recordTime: '' }));
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold outline-none transition-all bg-slate-50/70 text-slate-800 ${
                  errors.recordTime ? 'border-rose-300 ring-2 ring-rose-500/10' : themeFocusRing
                }`}
              />
              {errors.recordTime && (
                <p className="mt-1 text-[11px] text-rose-600 font-bold">{errors.recordTime}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Đánh giá Sức Khỏe Đàn Tôm (2 Nhánh Lớn) ─────────────── */}
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">
                2
              </span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Kết quả kiểm tra sức khỏe đàn tôm
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">Chọn 1 trong 2 tình trạng</span>
          </div>

          {/* 2 Big Cards for NORMAL vs ABNORMAL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CARD 1: TÔM KHỎE MẠNH / BÌNH THƯỜNG */}
            <div
              onClick={() => {
                setHealthCondition('NORMAL');
                setErrors({});
              }}
              className={`p-5 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                healthCondition === 'NORMAL'
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      healthCondition === 'NORMAL'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {healthCondition === 'NORMAL' && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Tôm Khỏe Mạnh / Bình Thường
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 font-medium leading-relaxed">
                    Tôm bơi linh hoạt, ruột đầy thức ăn, màu sắc gan tụy chuẩn nâu đen, vỏ cứng bóng, nhá ăn đều.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-emerald-100/80 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Chỉ cần lưu nhật ký kiểm tra định kỳ</span>
              </div>
            </div>

            {/* CARD 2: BẤT THƯỜNG / CÓ DẤU HIỆU BỆNH */}
            <div
              onClick={() => {
                setHealthCondition('ABNORMAL');
                setErrors({});
              }}
              className={`p-5 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                healthCondition === 'ABNORMAL'
                  ? 'border-rose-500 bg-rose-50/50 shadow-md shadow-rose-500/10 ring-2 ring-rose-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      healthCondition === 'ABNORMAL'
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {healthCondition === 'ABNORMAL' && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    Phát Hiện Bất Thường / Dấu Hiệu Bệnh
                    <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                      Cần điều trị
                    </span>
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 font-medium leading-relaxed">
                    Tôm có dấu hiệu lờ đờ, tấp mé, bỏ ăn, phân trắng, đục cơ, đen mang hoặc gan nhạt màu...
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-rose-100/80 flex items-center gap-1.5 text-xs font-bold text-rose-700">
                <Stethoscope className="w-4 h-4" />
                <span>Tự động tạo sự cố & chuyển sang phác đồ điều trị</span>
              </div>
            </div>
          </div>

          {/* ── Form Chi Tiết Theo Từng Nhánh ───────────────────────────────── */}
          {healthCondition === 'NORMAL' ? (
            /* Nhánh 1: Form đơn giản cho tôm bình thường */
            <div className="pt-2 animate-in fade-in duration-200 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ghi chú quan sát thêm (Tùy chọn)
                </label>
                <textarea
                  value={normalNote}
                  onChange={(e) => setNormalNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ví dụ: Tôm bơi lội khỏe, ăn hết 100% nhá, màu nước trong đẹp, gan ruột sắc nét..."
                  className={`w-full px-4 py-3 rounded-2xl border text-xs font-medium outline-none transition-all resize-none bg-slate-50/60 text-slate-800 placeholder:text-slate-400 ${themeFocusRing}`}
                />
                <div className="flex justify-between items-center mt-1 text-[11px] text-slate-400">
                  <span>Ghi nhận này sẽ lưu vào lịch sử nhật ký kiểm tra hàng ngày của ao.</span>
                  <span>{normalNote.length}/500</span>
                </div>
              </div>
            </div>
          ) : (
            /* Nhánh 2: Form chi tiết chuyển sang sự cố điều trị */
            <div className="pt-3 border-t border-slate-100 animate-in fade-in duration-300 space-y-5">
              {/* Chọn nhanh triệu chứng phổ biến */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Dấu hiệu / Triệu chứng phát hiện <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SYMPTOMS.map((sym) => {
                    const isSelected = selectedSymptoms.includes(sym.label);
                    return (
                      <button
                        type="button"
                        key={sym.id}
                        onClick={() => toggleSymptom(sym.label)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isSelected ? 'bg-rose-500' : 'bg-slate-300'
                          }`}
                        />
                        {sym.label}
                      </button>
                    );
                  })}
                </div>
                {errors.symptoms && (
                  <p className="mt-1.5 text-[11px] text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.symptoms}
                  </p>
                )}
              </div>

              {/* Nhập thêm triệu chứng khác */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Biểu hiện khác (nếu có)
                  </label>
                  <input
                    type="text"
                    value={customSymptom}
                    onChange={(e) => {
                      setCustomSymptom(e.target.value);
                      updateIncidentTitleAndDesc(selectedSymptoms, e.target.value);
                    }}
                    placeholder="Nhập dấu hiệu khác quan sát được..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all bg-slate-50/60 text-slate-800 ${themeFocusRing}`}
                  />
                </div>

                {/* Tỷ lệ ảnh hưởng (%) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Percent className="w-3.5 h-3.5 text-indigo-600" />
                      Tỷ lệ tôm bị ảnh hưởng ước tính (%)
                    </label>
                    <span className="text-xs font-extrabold text-rose-700">
                      {affectedPercentage}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={affectedPercentage}
                      onChange={(e) => {
                        setAffectedPercentage(e.target.value);
                        updateIncidentTitleAndDesc(selectedSymptoms, customSymptom);
                      }}
                      className="flex-1 accent-rose-600 cursor-pointer"
                    />
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={affectedPercentage}
                      onChange={(e) => {
                        setAffectedPercentage(e.target.value);
                        updateIncidentTitleAndDesc(selectedSymptoms, customSymptom);
                      }}
                      className="w-16 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-center outline-none"
                    />
                  </div>
                  {errors.affectedPercentage && (
                    <p className="mt-1 text-[11px] text-rose-600 font-bold">{errors.affectedPercentage}</p>
                  )}
                </div>
              </div>

              {/* Mức độ nghiêm trọng */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" /> Mức độ nghiêm trọng
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => setSeverity(opt.value)}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                        severity === opt.value
                          ? `${opt.color} border-current shadow-xs`
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span>{opt.label}</span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            opt.value === 'MILD'
                              ? 'bg-amber-400'
                              : opt.value === 'MODERATE'
                              ? 'bg-orange-500'
                              : 'bg-rose-500'
                          }`}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 font-medium leading-snug">
                        {opt.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tiêu đề sự cố sẽ tạo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tiêu đề sự cố điều trị <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={incidentTitle}
                  onChange={(e) => {
                    setIncidentTitle(e.target.value);
                    setErrors((prev) => ({ ...prev, incidentTitle: '' }));
                  }}
                  placeholder="Ví dụ: Sự cố sức khỏe ao 1: Tôm tấp mé bờ, bỏ ăn..."
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-bold outline-none transition-all bg-slate-50/70 text-slate-800 ${
                    errors.incidentTitle ? 'border-rose-300 ring-2 ring-rose-500/10' : themeFocusRing
                  }`}
                />
                {errors.incidentTitle && (
                  <p className="mt-1 text-[11px] text-rose-600 font-bold">{errors.incidentTitle}</p>
                )}
              </div>

              {/* Mô tả chi tiết sự cố */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mô tả tình trạng chi tiết phục vụ điều trị & cấp thuốc
                </label>
                <textarea
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  rows={3}
                  placeholder="Ghi rõ màu sắc gan tụy, vỏ tôm, đường ruột hoặc các bất thường môi trường nước đi kèm..."
                  className={`w-full px-4 py-3 rounded-2xl border text-xs font-medium outline-none transition-all resize-none bg-slate-50/60 text-slate-800 placeholder:text-slate-400 ${themeFocusRing}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Actions Button Bar ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                healthCondition === 'NORMAL' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
              }`}
            />
            <span>
              {healthCondition === 'NORMAL'
                ? 'Đang ở chế độ: Ghi nhận tôm phát triển bình thường định kỳ'
                : 'Đang ở chế độ: Phát hiện bất thường -> Kích hoạt điều trị sự cố'}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
            >
              Đặt lại
            </button>

            {healthCondition === 'NORMAL' ? (
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/25 hover:-translate-y-0.5 cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Lưu nhật ký định kỳ
                  </>
                )}
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/25 hover:-translate-y-0.5 cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo sự cố...
                  </>
                ) : (
                  <>
                    <Stethoscope className="w-4 h-4 text-rose-100" /> Tạo sự cố & Bắt đầu điều trị
                    <ArrowRight className="w-4 h-4 text-rose-200" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
