import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  FileText,
  Filter,
  RefreshCw,
  Sparkles,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSun,
  Wind,
  Droplets,
  Thermometer,
  FlaskConical,
  Waves,
  AlertTriangle,
  Info,
  History,
} from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { waterQualityService } from '../../services/water-quality.service';
import { weatherService, type WeatherInfo } from '../../services/weather.service';

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

interface HistoryRecord {
  id: string;
  recordTime: string;
  farmName: string;
  pondName: string;
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  salinity: number;
  alkalinity: number;
  nh3: number;
  h2s?: number;
  no2?: number;
  transparency: number;
  waterColor?: string;
  overallStatus: 'Optimal' | 'Warning' | 'Danger';
  note?: string;
  weatherData?: WeatherInfo | null;
  createdAt: string;
}

function getParamStatus(name: string, val: number): 'optimal' | 'warning' | 'danger' {
  switch (name) {
    case 'temperature':
      if (val >= 25 && val <= 30) return 'optimal';
      if ((val >= 20 && val < 25) || (val > 30 && val <= 33)) return 'warning';
      return 'danger';
    case 'ph':
      if (val >= 8.2 && val <= 8.5) return 'optimal';
      if ((val >= 7.5 && val < 8.2) || (val > 8.5 && val <= 9.0)) return 'warning';
      return 'danger';
    case 'dissolvedOxygen':
      if (val > 4.0) return 'optimal';
      if (val >= 3.0) return 'warning';
      return 'danger';
    case 'salinity':
      if (val >= 10 && val <= 25) return 'optimal';
      if ((val >= 5 && val < 10) || (val > 25 && val <= 30)) return 'warning';
      return 'danger';
    case 'alkalinity':
      if (val >= 100 && val <= 160) return 'optimal';
      if ((val >= 80 && val < 100) || (val > 160 && val <= 200)) return 'warning';
      return 'danger';
    case 'nh3':
      if (val <= 0.30) return 'optimal';
      if (val <= 0.50) return 'warning';
      return 'danger';
    case 'h2s':
      if (val <= 0.03) return 'optimal';
      if (val <= 0.05) return 'warning';
      return 'danger';
    case 'no2':
      if (val <= 0.20) return 'optimal';
      if (val <= 0.80) return 'warning';
      return 'danger';
    case 'transparency':
      if (val >= 25 && val <= 40) return 'optimal';
      if ((val >= 20 && val < 25) || (val > 40 && val <= 50)) return 'warning';
      return 'danger';
    default:
      return 'optimal';
  }
}

function getWaterColorStatus(v?: string): 'optimal' | 'warning' | 'danger' {
  if (!v) return 'optimal';
  const val = v.toLowerCase().trim();
  if (val.includes('xanh lục') || val.includes('xanh vỏ đậu') || val.includes('màu nâu nhạt') || val.includes('nâu nhạt')) {
    return 'optimal';
  }
  if (val.includes('đỏ') || val.includes('đen')) {
    return 'danger';
  }
  return 'warning';
}

export default function WaterQualityHistory() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const isFarmer = currentUser?.role === 'FARMER';
  
  const themeTextGradientHeader = isFarmer
    ? 'from-teal-700 to-emerald-500'
    : 'from-indigo-900 via-indigo-800 to-purple-600';
  const themeGradientHeader = isFarmer 
    ? 'from-teal-500 to-emerald-400' 
    : 'from-indigo-600 to-purple-500';
  const themeShadowHeader = isFarmer ? 'shadow-teal-500/30' : 'shadow-indigo-500/30';
  const themeFocusRing = isFarmer 
    ? 'focus:border-teal-500 focus:ring-teal-500/10' 
    : 'focus:border-indigo-500 focus:ring-indigo-500/10';
  const themeSpinner = isFarmer ? 'border-t-teal-600' : 'border-t-indigo-600';
  const themeText500 = isFarmer ? 'text-teal-500' : 'text-indigo-500';
  const themeBg = isFarmer ? 'bg-teal-600' : 'bg-indigo-600';
  const themeBgHover = isFarmer ? 'hover:bg-teal-700' : 'hover:bg-indigo-700';
  const themeShadow = isFarmer ? 'shadow-teal-500/20' : 'shadow-indigo-500/20';

  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [recordWeather, setRecordWeather] = useState<WeatherInfo | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  const filteredPonds = selectedFarmId
    ? ponds.filter((p) => p.farmId === selectedFarmId)
    : ponds;

  useEffect(() => {
    (async () => {
      try {
        const [farmsData, pondsData] = await Promise.all([
          farmService.getAll(),
          pondService.getAll(),
        ]);
        setFarms(farmsData);
        setPonds(pondsData);
      } catch {
        setErrorMsg('Không thể tải thông tin trang trại và ao nuôi');
      }
    })();
  }, []);

  useEffect(() => {
    if (showDetailDialog && selectedRecord) {
      if (selectedRecord.weatherData) {
        // Use exact historical snapshot stored when technician recorded
        setRecordWeather(selectedRecord.weatherData);
        setLoadingWeather(false);
      } else {
        // Fallback for older legacy records without snapshot
        const pond = ponds.find((p) => p.name === selectedRecord.pondName);
        const farm = farms.find((f) => f.name === selectedRecord.farmName);
        const farmId = pond?.farmId || farm?.id || selectedFarmId;
        setLoadingWeather(true);
        weatherService
          .getWeather(farmId ? { farmId } : undefined)
          .then((w) => setRecordWeather(w))
          .catch(() => setRecordWeather(null))
          .finally(() => setLoadingWeather(false));
      }
    } else {
      setRecordWeather(null);
    }
  }, [showDetailDialog, selectedRecord, ponds, farms, selectedFarmId]);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await waterQualityService.getHistory({
        farmId: selectedFarmId || undefined,
        pondId: selectedPondId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        size,
        sort: 'desc',
      });
      setRecords(data.content || []);
      setTotalElements(data.totalElements || 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tải lịch sử đo');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, selectedPondId, fromDate, toDate, page, size]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleResetFilters = () => {
    setSelectedFarmId('');
    setSelectedPondId('');
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  const totalPages = Math.ceil(totalElements / size);

  const getStatusBadge = (status: 'Optimal' | 'Warning' | 'Danger') => {
    switch (status) {
      case 'Optimal':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Tối ưu</span>;
      case 'Warning':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Cảnh báo</span>;
      case 'Danger':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-50 text-red-700 border border-red-200">Nguy hiểm</span>;
      default:
        return null;
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const renderWeatherIcon = (icon?: string) => {
    switch (icon) {
      case 'sunny': return <Sun className="w-5 h-5 text-amber-500 animate-spin-slow" />;
      case 'rainy': return <CloudRain className="w-5 h-5 text-blue-500" />;
      case 'thunder': return <CloudLightning className="w-5 h-5 text-purple-500" />;
      case 'cloudy': return <Cloud className="w-5 h-5 text-slate-400" />;
      default: return <CloudSun className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${themeGradientHeader} flex items-center justify-center text-white shadow-lg ${themeShadowHeader}`}>
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className={`text-xl font-bold bg-gradient-to-r ${themeTextGradientHeader} bg-clip-text text-transparent`}>
              Lịch Sử Đo Lường Môi Trường
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Theo dõi dữ liệu đo đạc chất lượng nước, thời tiết & khuyến nghị AI</p>
          </div>
        </div>
        <button onClick={fetchHistory} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer">
          <RefreshCw className="w-4 h-4 text-slate-500" /> Làm mới dữ liệu
        </button>
      </div>

      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" /> Bộ Lọc Tìm Kiếm
          </span>
          {(selectedFarmId || selectedPondId || fromDate || toDate) && (
            <button onClick={handleResetFilters} className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" /> Đặt lại bộ lọc
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Trang trại</label>
            <select value={selectedFarmId} onChange={(e) => { setSelectedFarmId(e.target.value); setSelectedPondId(''); setPage(0); }} className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}>
              <option value="">Tất cả trang trại</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Ao nuôi</label>
            <select value={selectedPondId} onChange={(e) => { setSelectedPondId(e.target.value); setPage(0); }} className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}>
              <option value="">Tất cả ao</option>
              {filteredPonds.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Từ ngày</label>
            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }} className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Đến ngày</label>
            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }} className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`} />
          </div>
        </div>
      </div>

      {/* ─── Cards Grid Section ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-3">
          <div className={`w-8 h-8 border-4 border-slate-200 ${themeSpinner} rounded-full animate-spin`} />
          <p className="text-xs font-bold text-slate-500">Đang tải dữ liệu lịch sử đo...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 p-6 rounded-3xl border border-red-200 text-red-700 text-center space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
          <p className="text-sm font-bold">{errorMsg}</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 text-center space-y-3">
          <FileText className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">Chưa có bản ghi đo lường nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Không tìm thấy dữ liệu nào phù hợp với bộ lọc hiện tại. Hãy thử chọn khoảng thời gian khác hoặc kiểm tra ao nuôi.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Responsive Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {records.map((r) => {
              const d = new Date(r.recordTime);
              const timeStr = isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
              const dateStr = isNaN(d.getTime()) ? '-' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

              return (
                <div
                  key={r.id}
                  onClick={() => {
                    setSelectedRecord(r);
                    setShowDetailDialog(true);
                  }}
                  className={`bg-white/90 backdrop-blur-lg rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/50 hover:shadow-2xl ${
                    isFarmer ? 'hover:shadow-teal-500/10' : 'hover:shadow-indigo-500/10'
                  } hover:-translate-y-1.5 duration-300 flex flex-col justify-between cursor-pointer overflow-hidden p-6 gap-4 group relative transition-all`}
                >
                  {/* Card Header: Time & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                      <Calendar className={`w-3.5 h-3.5 ${themeText500}`} />
                      <span>{timeStr}</span>
                      <span className="text-slate-300">•</span>
                      <span>{dateStr}</span>
                    </div>
                    {getStatusBadge(r.overallStatus)}
                  </div>

                  {/* Card Location Info */}
                  <div>
                    <h4 className={`text-lg font-black text-slate-800 ${isFarmer ? 'group-hover:text-teal-600' : 'group-hover:text-indigo-600'} transition-colors`}>
                      {r.pondName}
                    </h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {r.farmName}
                    </p>
                  </div>

                  {/* Symmetrical Param Matrix Grid (3x3) */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-3 rounded-2xl border border-slate-100/60 shadow-inner">
                    {/* Temperature */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/70 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Nhiệt độ</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.temperature}<span className="text-[9px] font-medium text-slate-400 ml-0.5">°C</span>
                      </span>
                    </div>

                    {/* pH */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/70 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">pH</span>
                      <span className="text-xs font-black text-slate-700 mt-1">{r.ph}</span>
                    </div>

                    {/* DO */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/70 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">DO</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.dissolvedOxygen}<span className="text-[9px] font-medium text-slate-400 ml-0.5">mg/L</span>
                      </span>
                    </div>

                    {/* Salinity */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/70 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Độ mặn</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.salinity}<span className="text-[9px] font-medium text-slate-400 ml-0.5">ppt</span>
                      </span>
                    </div>

                    {/* Alkalinity */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/70 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Độ kiềm</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.alkalinity}<span className="text-[9px] font-medium text-slate-400 ml-0.5">mg/L</span>
                      </span>
                    </div>

                    {/* NH3 */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/70 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">NH3</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.nh3}<span className="text-[8px] font-medium text-slate-400 ml-0.5">mg/L</span>
                      </span>
                    </div>

                    {/* H2S */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/70 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">H2S</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.h2s ?? r.no2 ?? 0}<span className="text-[8px] font-medium text-slate-400 ml-0.5">mg/L</span>
                      </span>
                    </div>

                    {/* Transparency */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/70 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Độ trong</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.transparency}<span className="text-[8px] font-medium text-slate-400 ml-0.5">cm</span>
                      </span>
                    </div>

                    {/* Water Color / Note Indicator */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/70 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Màu nước</span>
                      <span className="text-[11px] font-bold mt-1 text-slate-700 truncate max-w-full">
                        {r.waterColor || (r.note ? '📝 Có ghi chú' : '—')}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Detail Link indicator */}
                  <div className="flex items-center justify-end pt-3 border-t border-slate-100/60 mt-1">
                    <span className={`text-xs font-bold ${isFarmer ? 'text-teal-600' : 'text-indigo-600'} flex items-center gap-1 group-hover:translate-x-0.5 transition-transform`}>
                      <Eye className="w-3.5 h-3.5" /> Chi tiết & Đánh giá AI
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm text-xs">
              <span className="text-slate-500 font-medium">
                Hiển thị bản ghi từ <span className="font-bold text-slate-700">{page * size + 1}</span> đến{' '}
                <span className="font-bold text-slate-700">{Math.min((page + 1) * size, totalElements)}</span>{' '}
                trong tổng số <span className="font-bold text-slate-700">{totalElements}</span> bản ghi
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-slate-700">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showDetailDialog && selectedRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/70 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold ${themeText500} uppercase tracking-widest`}>Chi tiết bản ghi & Đánh giá AI</span>
                  {getStatusBadge(selectedRecord.overallStatus)}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mt-0.5 flex items-center gap-2">
                  <Waves className="w-5 h-5 text-blue-600" />
                  {selectedRecord.pondName}
                  <span className="text-sm font-normal text-slate-400">({selectedRecord.farmName})</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Thời gian đo: <strong>{formatDate(selectedRecord.recordTime)}</strong></p>
              </div>
              <button onClick={() => { setShowDetailDialog(false); setSelectedRecord(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">✕</button>
            </div>
            <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-4">
              <div className="p-4 bg-gradient-to-r from-sky-50 to-blue-50/50 rounded-2xl border border-sky-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {loadingWeather ? <div className="w-5 h-5 border-2 border-sky-400 border-t-sky-600 rounded-full animate-spin" /> : renderWeatherIcon(recordWeather?.icon)}
                    <span className="text-xs font-bold text-sky-950 uppercase tracking-wider">
                      Thời tiết lúc đo {recordWeather?.locationName ? `(${recordWeather.locationName})` : ''}
                    </span>
                    {selectedRecord.weatherData && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-sky-200/70 text-sky-800">
                        Snapshot
                      </span>
                    )}
                  </div>
                  {recordWeather && <span className="text-xs font-bold text-sky-700 bg-sky-100/80 px-2.5 py-0.5 rounded-full">{recordWeather.condition}</span>}
                </div>
                {recordWeather ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-white/80 rounded-xl border border-sky-100/80 flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <div><div className="text-[10px] text-slate-400">Nhiệt độ KK</div><div className="font-bold text-slate-800">{recordWeather.temperature}°C</div></div>
                    </div>
                    <div className="p-2 bg-white/80 rounded-xl border border-sky-100/80 flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div><div className="text-[10px] text-slate-400">Độ ẩm KK</div><div className="font-bold text-slate-800">{recordWeather.humidity}%</div></div>
                    </div>
                    <div className="p-2 bg-white/80 rounded-xl border border-sky-100/80 flex items-center gap-2">
                      <Wind className="w-4 h-4 text-teal-500 flex-shrink-0" />
                      <div><div className="text-[10px] text-slate-400">Tốc độ gió</div><div className="font-bold text-slate-800">{recordWeather.windSpeed} km/h</div></div>
                    </div>
                    <div className="p-2 bg-white/80 rounded-xl border border-sky-100/80 flex items-center gap-2">
                      <CloudRain className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <div><div className="text-[10px] text-slate-400">Lượng mưa</div><div className="font-bold text-slate-800">{recordWeather.precipitation || 0} mm</div></div>
                    </div>
                  </div>
                ) : <p className="text-xs text-slate-400 italic">Đang cập nhật dữ liệu khí tượng trang trại...</p>}
                {recordWeather?.forecastHint && <div className="text-[11px] text-sky-800 font-medium flex items-center gap-1.5 bg-white/60 p-2 rounded-xl border border-sky-100"><Info className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" /><span>{recordWeather.forecastHint}</span></div>}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">Các chỉ số hóa lý môi trường ao</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { label: 'Nhiệt độ nước', val: `${selectedRecord.temperature}°C`, status: getParamStatus('temperature', selectedRecord.temperature), icon: <Thermometer className="w-3.5 h-3.5" /> },
                    { label: 'pH', val: selectedRecord.ph, status: getParamStatus('ph', selectedRecord.ph), icon: <FlaskConical className="w-3.5 h-3.5" /> },
                    { label: 'Oxy hòa tan (DO)', val: `${selectedRecord.dissolvedOxygen} mg/L`, status: getParamStatus('dissolvedOxygen', selectedRecord.dissolvedOxygen), icon: <Waves className="w-3.5 h-3.5" /> },
                    { label: 'Độ mặn', val: `${selectedRecord.salinity} ppt`, status: getParamStatus('salinity', selectedRecord.salinity), icon: <Droplets className="w-3.5 h-3.5" /> },
                    { label: 'Độ kiềm', val: `${selectedRecord.alkalinity} mg/L`, status: getParamStatus('alkalinity', selectedRecord.alkalinity), icon: <FlaskConical className="w-3.5 h-3.5" /> },
                    { label: 'Khí độc NH3', val: `${selectedRecord.nh3} mg/L`, status: getParamStatus('nh3', selectedRecord.nh3), icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                    { label: 'Khí độc H2S', val: `${selectedRecord.h2s ?? selectedRecord.no2 ?? 0} mg/L`, status: getParamStatus('h2s', selectedRecord.h2s ?? selectedRecord.no2 ?? 0), icon: <AlertCircle className="w-3.5 h-3.5" /> },
                    { label: 'Độ trong', val: `${selectedRecord.transparency} cm`, status: getParamStatus('transparency', selectedRecord.transparency), icon: <Eye className="w-3.5 h-3.5" /> },
                    { label: 'Màu nước', val: selectedRecord.waterColor || 'Chưa ghi', status: getWaterColorStatus(selectedRecord.waterColor), icon: <Droplets className="w-3.5 h-3.5" /> },
                  ].map((p, idx) => (
                    <div key={idx} className={`p-2.5 rounded-2xl border transition-all ${p.status === 'optimal' ? 'bg-emerald-50/40 border-emerald-200' : p.status === 'warning' ? 'bg-amber-50/40 border-amber-200' : 'bg-red-50/40 border-red-200'}`}>
                      <div className="flex items-center justify-between text-slate-400 mb-1"><span className="text-[10px] font-bold uppercase truncate">{p.label}</span>{p.icon}</div>
                      <div className="text-sm font-extrabold text-slate-800">{p.val}</div>
                      <div className="mt-1"><span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${p.status === 'optimal' ? 'bg-emerald-100 text-emerald-700' : p.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{p.status === 'optimal' ? 'Tối ưu' : p.status === 'warning' ? 'Cảnh báo' : 'Nguy hiểm'}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" /> Đánh Giá Chuyên Sâu & Khuyến Nghị AI (5T Care)
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {selectedRecord.overallStatus === 'Optimal' ? 'Sinh trưởng tối ưu' : selectedRecord.overallStatus === 'Warning' ? 'Cần theo dõi sát' : 'Cần xử lý khẩn cấp'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {selectedRecord.overallStatus === 'Optimal'
                    ? 'Chất lượng nước ao nuôi đang ở trạng thái tối ưu theo tiêu chuẩn 5T Care. Tôm phát triển ổn định, hấp thụ thức ăn tốt và môi trường không có khí độc đe dọa.'
                    : selectedRecord.overallStatus === 'Warning'
                    ? 'Phát hiện một số chỉ số môi trường tiệm cận ngưỡng cảnh báo. Cần tăng cường quạt nước, theo dõi sát lượng ăn và sẵn sàng bổ sung khoáng/men vi sinh.'
                    : 'Cảnh báo khẩn cấp: Chỉ số nước vượt ngưỡng an toàn! Cần can thiệp ngay lập tức để tránh gây stress hoặc sốc môi trường cho tôm.'}
                </p>
                <div className="pt-2 border-t border-indigo-100/60 text-xs text-indigo-900 font-medium">
                  💡 <strong>Khuyến nghị 5T Care:</strong> {selectedRecord.overallStatus === 'Optimal' ? 'Duy trì chế độ chạy quạt và cho ăn theo kế hoạch.' : 'Giảm 20% lượng thức ăn, bật tăng cường quạt nước và kiểm tra lại sau 4 giờ.'}
                </div>
              </div>

              {/* Note */}
              <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú</span>
                <p className="text-sm font-semibold text-slate-700 mt-1 whitespace-pre-wrap">
                  {selectedRecord.note || 'Không có ghi chú.'}
                </p>
              </div>
            </div>

            {/* Footer close */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDetailDialog(false);
                  setSelectedRecord(null);
                }}
                className={`flex-1 py-3 ${themeBg} ${themeBgHover} text-white font-bold rounded-2xl transition-colors text-sm shadow-lg ${themeShadow}`}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
