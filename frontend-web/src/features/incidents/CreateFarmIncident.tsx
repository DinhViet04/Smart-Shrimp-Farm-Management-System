import { useState, useMemo, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  Info,
  RefreshCw,
  Send,
  Sparkles,
  Waves,
} from 'lucide-react';
import {
  incidentService,
  type Incident,
} from '../../services/incident.service';
import { pondService, type OverviewPond } from '../../services/pond.service';
import {
  FARM_INCIDENT_CATEGORIES,
  FARM_INCIDENT_SEVERITIES,
  LOCATION_SUGGESTIONS,
} from './farmIncidentConstants';

interface CreateFarmIncidentProps {
  role: 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER';
  onBack: () => void;
  onSuccess: (incident: Incident, isSelfAssigned?: boolean) => void;
}

const COMMON_INCIDENT_TITLE_SUGGESTIONS: Record<string, string[]> = {
  'Thiết bị & Máy móc': [
    'Cháy motor dàn quạt số 2 bốc khói',
    'Máy cho ăn tự động bị kẹt cánh quạt',
    'Máy sục khí O2 ngưng hoạt động bất ngờ',
    'Máy bơm nước cấp bị hỏng phốt rò rỉ',
  ],
  'Điện lưới & Năng lượng': [
    'Aptomat trạm biến áp trung tâm bị nhảy liên tục',
    'Mất điện trạm bơm, máy phát dự phòng không tự nổ',
    'Dây cáp điện trạm bơm bị đứt nghi do chuột cắn',
    'Nổ tụ bù tủ điện điều khiển',
  ],
  'Bờ ao, Bạt lót & Cống': [
    'Rách bạt đáy HDPE bờ tây dài khoảng 50cm',
    'Sạt lở bờ bao thoát lũ phía đông',
    'Van cống xả đáy bị rò rỉ nước ra ngoài mương',
    'Bung lưới chắn rác cống cấp nước',
  ],
  'Kênh cấp & Nguồn nước': [
    'Nước kênh cấp ngoài có váng dầu và mùi lạ',
    'Rác thải và lục bình bít kín miệng cống lấy nước',
    'Mực nước kênh cấp ngoài sông xuống quá thấp',
  ],
  'Kho bãi & Vật tư': [
    'Bao thức ăn trong kho số 2 bị dột nước mưa',
    'Phát hiện chuột cắn rách nhiều bao cám',
    'Bao hóa chất xử lý vôi tạt bị rách ẩm ướt',
    'Hỏng ổ khóa cửa kho vật tư',
  ],
  'An ninh & Sự cố khác': [
    'Mưa dông lớn làm tốc mái tôn chòi trực bờ đông',
    'Phát hiện người lạ tiếp cận khu vực ao nuôi',
    'Đường nội bộ trang trại bị sạt lở xe không qua được',
  ],
};

export default function CreateFarmIncident({
  role,
  onBack,
  onSuccess,
}: CreateFarmIncidentProps) {
  const isManager = role === 'FARM_MANAGER' || role === 'ADMIN';

  // Form states
  const [locationType, setLocationType] = useState<'pond' | 'facility'>('pond');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [facilityArea, setFacilityArea] = useState('⚡ Trạm biến áp trung tâm');
  const [locationDetail, setLocationDetail] = useState('');

  const [category, setCategory] = useState('Thiết bị & Máy móc');
  const [severity, setSeverity] = useState('Trung bình');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selfAssign, setSelfAssign] = useState(false);

  // Metadata
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [farmId, setFarmId] = useState('');
  const [loadingPonds, setLoadingPonds] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    location?: string;
    title?: string;
    description?: string;
  }>({});

  // Load ponds for location selector
  useEffect(() => {
    let isMounted = true;
    pondService
      .getOverview()
      .then((overview) => {
        if (!isMounted) return;
        const pondList = overview?.ponds || [];
        setPonds(pondList);
        if (overview?.farms?.[0]?.id) {
          setFarmId(overview.farms[0].id);
        } else if (pondList[0]?.farmId) {
          setFarmId(pondList[0].farmId);
        }
        if (pondList.length > 0 && !selectedPondId) {
          setSelectedPondId(pondList[0].id);
        }
      })
      .catch((err) => {
        console.warn('Failed to load farm ponds for incident reporting:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingPonds(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPondId]);

  // Selected Category
  const selectedCategoryObj = useMemo(() => {
    return (
      FARM_INCIDENT_CATEGORIES.find((c) => c.id === category) ||
      FARM_INCIDENT_CATEGORIES[0]
    );
  }, [category]);

  // Selected Pond Name
  const selectedPond = useMemo(() => {
    return ponds.find((p) => p.id === selectedPondId);
  }, [ponds, selectedPondId]);

  // Compute final location string
  const computedLocationString = useMemo(() => {
    if (locationType === 'pond') {
      const pondName = selectedPond?.name || 'Ao nuôi';
      return locationDetail.trim() ? `${pondName} (${locationDetail.trim()})` : pondName;
    }
    return locationDetail.trim()
      ? `${facilityArea} - ${locationDetail.trim()}`
      : facilityArea;
  }, [locationType, selectedPond, facilityArea, locationDetail]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { location?: string; title?: string; description?: string } = {};

    if (locationType === 'pond' && !selectedPondId) {
      errors.location = 'Vui lòng chọn ao nuôi xảy ra sự cố.';
    }

    if (!title.trim()) {
      errors.title = 'Vui lòng nhập tiêu đề sự cố trang trại.';
    } else if (title.trim().length < 4) {
      errors.title = 'Tiêu đề sự cố cần rõ ràng (tối thiểu 4 ký tự).';
    }

    if (!description.trim()) {
      errors.description = 'Vui lòng mô tả chi tiết hiện trạng thiết bị/hạ tầng.';
    } else if (description.trim().length < 6) {
      errors.description = 'Nội dung mô tả nên chi tiết hơn để Quản lý nắm rõ thông tin (tối thiểu 6 ký tự).';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError('Vui lòng hoàn thiện các trường thông tin bắt buộc.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload: Parameters<typeof incidentService.create>[0] = {
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        location: computedLocationString,
        selfAssign: isManager ? selfAssign : false,
      };

      if (locationType === 'pond' && selectedPondId) {
        payload.pondId = selectedPondId;
      }
      if (farmId) {
        payload.farmId = farmId;
      }

      const created = await incidentService.create(payload);
      onSuccess(created, isManager && selfAssign);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message.includes('ERR_CONNECTION'))
      ) {
        setError(
          'Không thể kết nối đến máy chủ backend (http://localhost:3000). Vui lòng kiểm tra server đang chạy.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Không thể gửi báo cáo sự cố');
      }
    } finally {
      setSaving(false);
    }
  };

  const titleSuggestions = COMMON_INCIDENT_TITLE_SUGGESTIONS[category] || [];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300 font-sans">
      {/* ── BREADCRUMB & BACK ACTION BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all shadow-2xs cursor-pointer"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className="hover:text-slate-700 cursor-pointer" onClick={onBack}>
                Sự Cố Trang Trại
              </span>
              <span>/</span>
              <span className="text-amber-700 font-bold">Lập Báo Cáo</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Phiếu Báo Cáo Sự Cố Trang Trại
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Thiết bị & Hạ tầng trang trại
          </span>
        </div>
      </div>

      {/* ── TOP NOTIFICATION NOTICE ── */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Quy trình điều phối sự cố trang trại:</p>
          <p className="text-blue-800 mt-0.5">
            {isManager
              ? 'Là Quản lý trang trại, bạn có thể lập sự cố để phân công kỹ thuật viên hoặc tự tiếp nhận xử lý ngay.'
              : 'Sau khi bạn gửi phiếu, Quản lý trang trại sẽ nhận thông báo thời gian thực để tiếp nhận và phân công nhân sự đến hiện trường khắc phục.'}
          </p>
        </div>
      </div>

      {/* ── ERROR ALERT ── */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 flex items-center gap-3 animate-shake">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── FORM ── */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── BƯỚC 1: VỊ TRÍ & KHU VỰC SỰ CỐ ── */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-xs font-black text-amber-800">
                1
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Vị trí & Hiện trường sự cố
              </h2>
            </div>
            <span className="text-xs text-slate-400">Chọn vị trí chính xác tại trại</span>
          </div>

          {/* Toggle Type: Ao nuôi vs Khu vực dùng chung */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLocationType('pond')}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                locationType === 'pond'
                  ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  locationType === 'pond'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Waves className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Tại Ao Nuôi Cụ Thể</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dàn quạt, sục khí, máy cho ăn, cống xả, bạt lót của ao
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLocationType('facility')}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                locationType === 'facility'
                  ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  locationType === 'facility'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">
                  Khu Vực Cơ Sở Vật Chất Chung
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Trạm biến áp, trạm bơm, kho cám, kho hóa chất, kênh cấp
                </p>
              </div>
            </button>
          </div>

          {/* Conditional location inputs */}
          {locationType === 'pond' ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Chọn Ao nuôi <span className="text-rose-500">*</span>
              </label>
              {loadingPonds ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Đang tải danh sách ao...
                </div>
              ) : ponds.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {ponds.map((p) => {
                    const isSelected = selectedPondId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPondId(p.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white shadow-xs font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div className="text-sm font-bold truncate">{p.name}</div>
                        <div
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {p.areaSize ? `${p.areaSize} m²` : 'Ao nuôi'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                  Không tìm thấy danh sách ao nuôi. Sự cố sẽ được ghi nhận cho toàn trang trại.
                </p>
              )}
              {fieldErrors.location && (
                <p className="text-xs text-rose-600 font-bold">{fieldErrors.location}</p>
              )}

              <div className="mt-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Vị trí chi tiết tại ao (tùy chọn)
                </label>
                <input
                  type="text"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder="Ví dụ: Dàn quạt số 2 bờ tây, cống xả đáy bờ nam..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none bg-slate-50/60"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Khu vực cơ sở vật chất <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LOCATION_SUGGESTIONS.map((loc) => {
                  const isSelected = facilityArea === loc;
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setFacilityArea(loc)}
                      className={`p-2.5 rounded-xl border text-xs text-left truncate transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                          : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-white'
                      }`}
                    >
                      {loc}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mô tả vị trí cụ thể (tùy chọn)
                </label>
                <input
                  type="text"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder="Ví dụ: Tủ điện số 1, Ngăn cám 2, Cửa kho phía sau..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none bg-slate-50/60"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── BƯỚC 2: PHÂN LOẠI & MỨC ĐỘ ── */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-xs font-black text-amber-800">
                2
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Phân loại & Mức độ khẩn cấp
              </h2>
            </div>
            <span className="text-xs text-slate-400">Đánh giá tính chất sự cố</span>
          </div>

          {/* Danh mục */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Danh mục sự cố trang trại <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FARM_INCIDENT_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-400/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat.icon}</span>
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? 'text-amber-900' : 'text-slate-800'
                        }`}
                      >
                        {cat.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mức độ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Mức độ nghiêm trọng <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {FARM_INCIDENT_SEVERITIES.map((sev) => {
                const isSelected = severity === sev.id;
                return (
                  <button
                    key={sev.id}
                    type="button"
                    onClick={() => setSeverity(sev.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? sev.chipClass + ' font-bold shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>{sev.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 truncate ${
                        isSelected ? 'text-white/90' : 'text-slate-400'
                      }`}
                    >
                      {sev.sublabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── BƯỚC 3: TIÊU ĐỀ & MÔ TẢ HIỆN TRƯỜNG ── */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-xs font-black text-amber-800">
                3
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Nội dung sự cố chi tiết
              </h2>
            </div>
            <span className="text-xs text-slate-400">Ghi nhận hiện trường</span>
          </div>

          {/* Quick title suggestions */}
          {titleSuggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Gợi ý tiêu đề thường gặp ({selectedCategoryObj.label}):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {titleSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      setTitle(sug);
                      setFieldErrors((prev) => ({ ...prev, title: '' }));
                    }}
                    className="rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tiêu đề */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tiêu đề sự cố <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setFieldErrors((prev) => ({ ...prev, title: '' }));
              }}
              placeholder={`Ví dụ: ${selectedCategoryObj.examples.replace(/^VD:\s*/, '')}`}
              className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all bg-slate-50/50 ${
                fieldErrors.title
                  ? 'border-rose-300 ring-2 ring-rose-500/20'
                  : 'border-slate-200 focus:border-amber-500 focus:bg-white'
              }`}
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs text-rose-600 font-bold">{fieldErrors.title}</p>
            )}
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mô tả hiện trạng hiện trường & mức độ ảnh hưởng{' '}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFieldErrors((prev) => ({ ...prev, description: '' }));
              }}
              placeholder="Ghi rõ hiện trạng thiết bị, dấu hiệu bất thường (tiếng ồn, mùi khét, rò rỉ, thời gian phát hiện), nguy cơ gián đoạn vận hành trang trại..."
              className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all resize-y bg-slate-50/50 ${
                fieldErrors.description
                  ? 'border-rose-300 ring-2 ring-rose-500/20'
                  : 'border-slate-200 focus:border-amber-500 focus:bg-white'
              }`}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-xs text-rose-600 font-bold">
                {fieldErrors.description}
              </p>
            )}
          </div>

          {/* Manager Self-Assign Option */}
          {isManager && (
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/50 cursor-pointer hover:bg-indigo-50 transition-colors">
                <input
                  type="checkbox"
                  checked={selfAssign}
                  onChange={(e) => setSelfAssign(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div>
                  <p className="text-xs font-bold text-indigo-950">
                    Tôi tự tiếp nhận và trực tiếp xử lý sự cố này ngay
                  </p>
                  <p className="text-[11px] text-indigo-700">
                    Sự cố sẽ tự động chuyển sang trạng thái "Đang khắc phục" và gán nhiệm vụ cho bạn.
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* ── SUBMIT BAR ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              {isManager
                ? 'Sự cố sẽ được lưu vào hệ thống quản lý toàn trang trại.'
                : 'Thông báo sẽ được chuyển đến Quản lý trang trại ngay khi bạn bấm gửi.'}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onBack}
              disabled={saving}
              className="flex-1 sm:flex-none rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Đang gửi báo cáo...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {isManager ? 'Lưu Sự Cố Trang Trại' : 'Gửi Báo Cáo Lên Quản Lý'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
