import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Calendar,
  RefreshCw,
  CheckCircle2,
  Waves,
  AlertCircle,
  X,
  Loader2,
  Building2,
  Scale,
  Check,
  TrendingUp,
  Award,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { cropService, type Crop } from '../../services/crop.service';
import {
  survivalRateService,
  type SurvivalRateStats,
} from '../../services/survival-rate.service';

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

interface SurvivalRateDashboardProps {
  viewOnly?: boolean;
}

export default function SurvivalRateDashboard({ viewOnly = false }: SurvivalRateDashboardProps) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [selectedCropId, setSelectedCropId] = useState('');

  const [stats, setStats] = useState<SurvivalRateStats | null>(null);

  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State for updating Harvest Count
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [actualHarvestCountInput, setActualHarvestCountInput] = useState<number | ''>('');
  const [actualHarvestKgInput, setActualHarvestKgInput] = useState<number | ''>('');
  const [actualHarvestSizeInput, setActualHarvestSizeInput] = useState<number | ''>('');
  const [submittingHarvest, setSubmittingHarvest] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToastNotification = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch initial farms & ponds
  useEffect(() => {
    fetchFarmsAndPonds();
  }, []);

  const fetchFarmsAndPonds = async () => {
    setError(null);
    try {
      const [farmsData, pondsData] = await Promise.all([
        farmService.getMy().catch(() => farmService.getAll()),
        pondService.getAll(),
      ]);
      setFarms(farmsData);
      setPonds(pondsData);
      if (farmsData.length > 0) {
        setSelectedFarmId(farmsData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách trang trại');
    }
  };

  // Filter ponds based on selected farm
  const farmPonds = useMemo(() => {
    if (!selectedFarmId) return [];
    return ponds.filter((p) => p.farmId === selectedFarmId);
  }, [ponds, selectedFarmId]);

  // When selected farm changes, update ponds & select first pond
  useEffect(() => {
    if (farmPonds.length > 0) {
      setSelectedPondId(farmPonds[0].id);
    } else {
      setSelectedPondId('');
      setCrops([]);
      setSelectedCropId('');
      setStats(null);
    }
  }, [selectedFarmId, farmPonds]);

  // Fetch crops for selected pond
  const fetchCropsForPond = useCallback(async (pondId: string) => {
    if (!pondId) {
      setCrops([]);
      setSelectedCropId('');
      setStats(null);
      return;
    }
    setLoadingStats(true);
    try {
      const cropsData = await cropService.getAll({ pondId });
      setCrops(cropsData);
      const activeCrops = cropsData.filter((c) => c.status === 'ACTIVE');
      if (activeCrops.length > 0) {
        setSelectedCropId(activeCrops[0].id);
      } else if (cropsData.length > 0) {
        setSelectedCropId(cropsData[0].id);
      } else {
        setSelectedCropId('');
        setStats(null);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải vụ nuôi');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPondId) {
      fetchCropsForPond(selectedPondId);
    }
  }, [selectedPondId, fetchCropsForPond]);

  // Fetch Survival Rate Stats for selected crop
  const fetchSurvivalData = useCallback(async (cropId: string) => {
    if (!cropId) return;
    setLoadingStats(true);
    setError(null);
    try {
      const statsRes = await survivalRateService.getSurvivalRate(cropId);
      setStats(statsRes);
      if (statsRes) {
        setActualHarvestCountInput(statsRes.harvestCount || '');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải tỷ lệ sống');
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCropId) {
      fetchSurvivalData(selectedCropId);
    }
  }, [selectedCropId, fetchSurvivalData]);

  // Submit Harvest Count Update
  const handleUpdateHarvestCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCropId) return;
    setSubmittingHarvest(true);
    try {
      await survivalRateService.updateHarvestCount(selectedCropId, {
        actualHarvestCount: actualHarvestCountInput !== '' ? Number(actualHarvestCountInput) : undefined,
        actualHarvestKg: actualHarvestKgInput !== '' ? Number(actualHarvestKgInput) : undefined,
        actualHarvestSize: actualHarvestSizeInput !== '' ? Number(actualHarvestSizeInput) : undefined,
      });
      showToastNotification('Đã ghi nhận số lượng tôm thu hoạch thành công!', 'success');
      setShowHarvestModal(false);
      await fetchSurvivalData(selectedCropId);
    } catch (err: any) {
      showToastNotification(err.message || 'Không thể cập nhật thu hoạch', 'error');
    } finally {
      setSubmittingHarvest(false);
    }
  };

  // Recharts Gauge Meter Data Calculation
  const gaugeData = useMemo(() => {
    if (!stats) return [];
    const rate = Math.min(100, Math.max(0, stats.survivalRate));
    const remaining = 100 - rate;
    return [
      { name: 'Tỷ lệ sống', value: rate },
      { name: 'Khác', value: remaining },
    ];
  }, [stats]);

  // FPT Branding Colors: Dark Blue (#0F172A / #1E3A8A) & FPT Orange (#F97316)
  const GAUGE_COLORS = useMemo(() => {
    if (!stats) return ['#F97316', '#CBD5E1'];
    if (stats.survivalRate >= (stats.targetSurvivalRate || 85)) {
      return ['#F97316', '#E2E8F0']; // FPT Orange for high survival
    } else if (stats.survivalRate >= 70) {
      return ['#EAB308', '#E2E8F0']; // Yellow for warning
    } else {
      return ['#EF4444', '#E2E8F0']; // Red for danger
    }
  }, [stats]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[100] px-5 py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-right-8 fade-in duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
              : 'bg-red-50 border-red-200 text-red-800 font-bold'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className="text-sm">{toast.message}</p>
        </div>
      )}

      {/* Header Bar - FPT University Branding: Dark Blue (#0F172A / #1E3A8A) & Orange accents */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 border border-orange-400/30">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Chuẩn Chăm Sóc FPT SSFM
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mt-1">
                Theo Dõi Tỷ Lệ Sống Tôm
              </h2>
              <p className="text-sm text-slate-300 font-medium">
                Tự động tính Tỷ lệ sống từ <strong className="text-orange-400">Số tôm thả ban đầu</strong> và <strong className="text-orange-400">Số lượng tôm ước tính hiện tại</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {!viewOnly && selectedCropId && (
              <button
                onClick={() => setShowHarvestModal(true)}
                className="px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 cursor-pointer"
              >
                <Scale className="w-4 h-4" /> Ghi nhận / Chốt số tôm thu hoạch
              </button>
            )}
            <button
              onClick={() => selectedCropId && fetchSurvivalData(selectedCropId)}
              className="p-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700 cursor-pointer"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Farm Select */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-orange-500" /> Trang Trại
          </label>
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl text-sm focus:bg-white focus:border-orange-500 outline-none transition-all cursor-pointer"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Pond Select */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-blue-600" /> Ao Nuôi
          </label>
          <select
            value={selectedPondId}
            onChange={(e) => setSelectedPondId(e.target.value)}
            disabled={farmPonds.length === 0}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer disabled:opacity-50"
          >
            {farmPonds.length === 0 ? (
              <option value="">Chưa có ao nuôi</option>
            ) : (
              farmPonds.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            )}
          </select>
        </div>

        {/* Crop Select */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Chọn Vụ Nuôi
          </label>
          <select
            value={selectedCropId}
            onChange={(e) => setSelectedCropId(e.target.value)}
            disabled={crops.length === 0}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl text-sm focus:bg-white focus:border-emerald-500 outline-none transition-all cursor-pointer disabled:opacity-50"
          >
            {crops.length === 0 ? (
              <option value="">Chưa có vụ nuôi</option>
            ) : (
              crops.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.status === 'ACTIVE' ? 'Đang nuôi' : c.status === 'HARVESTED' ? 'Đã thu hoạch' : 'Thất thu'}] Vụ ngày {format(new Date(c.startDate), 'dd/MM/yyyy')} ({c.initialShrimpCount.toLocaleString()} con)
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {error && (
        <div className="p-5 bg-red-50 text-red-700 rounded-3xl flex items-center gap-3 border border-red-200 shadow-sm">
          <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-bold">{error}</p>
            <p className="text-xs text-red-500 mt-0.5">Vui lòng chọn ao/vụ nuôi đã có dữ liệu thả giống hợp lệ.</p>
          </div>
        </div>
      )}

      {loadingStats ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-3" />
          <p className="text-slate-600 font-medium text-sm">Đang tính toán tỷ lệ sống...</p>
        </div>
      ) : !selectedCropId ? (
        <div className="text-center p-16 bg-white border border-slate-200 rounded-3xl shadow-sm">
          <Waves className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700 mb-1">Ao nuôi chưa có vụ thả giống</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">Vui lòng khởi tạo vụ nuôi trong quản lý ao để theo dõi tỷ lệ sống.</p>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Recharts Gauge / Radial Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                  <Activity className="w-4 h-4 text-orange-500" />
                  Đồng Hồ Tỷ Lệ Sống (%)
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black border ${
                    stats.status === 'OPTIMAL'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : stats.status === 'WARNING'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {stats.status === 'OPTIMAL' ? 'Đạt chuẩn 5T' : stats.status === 'WARNING' ? 'Cần chú ý' : 'Báo động'}
                </span>
              </div>

              {/* Gauge Meter using Recharts */}
              <div className="h-64 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={gaugeData}
                      cx="50%"
                      cy="58%"
                      startAngle={210}
                      endAngle={-30}
                      innerRadius={82}
                      outerRadius={104}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {gaugeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GAUGE_COLORS[index]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Gauge Text */}
                <div className="absolute text-center top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <p className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                    {stats.survivalRate}<span className="text-xl font-bold text-orange-500 ml-0.5">%</span>
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1.5 tracking-wider">
                    {stats.isHarvested ? 'Tỷ lệ sống thu hoạch' : 'Tỷ lệ sống ước tính'}
                  </p>
                </div>
              </div>
            </div>

            {/* Target Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>Mục tiêu vụ nuôi:</span>
                <span className="text-slate-900 font-black">{stats.targetSurvivalRate}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, stats.survivalRate)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Right Column: Key KPI Cards & Summary Box */}
          <div className="lg:col-span-2 space-y-6">

            {/* 3 Main KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Initial Stocking */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                  <Building2 className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tôm Thả Ban Đầu</p>
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100">Tự động</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {stats.initialStocking.toLocaleString()} <span className="text-xs font-normal text-slate-400">con</span>
                  </p>
                </div>
              </div>

              {/* Card 2: Harvest / Current Count */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tôm Hiện Tại / Thu Hoạch</p>
                    {stats.isHarvested && (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">Đã chốt</span>
                    )}
                  </div>
                  <p className="text-2xl font-black text-emerald-700">
                    {stats.harvestCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">con</span>
                  </p>
                </div>
              </div>

              {/* Card 3: Computed Survival Rate */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shadow-inner">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tỷ Lệ Sống Tính Được</p>
                  <p className="text-2xl font-black text-orange-600">
                    {stats.survivalRate}%
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Explanation Panel */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Chi Tiết Dữ Liệu Tính Tỷ Lệ Sống</h3>
                  <p className="text-xs text-slate-500">Tái sử dụng logic Tính số lượng tôm ước tính từ tính năng Sinh khối ao nuôi</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="font-bold text-slate-700 text-sm">1. Dữ liệu thả giống (stockingQuantity)</p>
                  <p className="text-slate-600">Số lượng thả: <strong className="text-slate-900">{stats.initialStocking.toLocaleString()} con</strong></p>
                  <p className="text-slate-500">Ngày bắt đầu thả: {format(new Date(stats.startDate), 'dd/MM/yyyy')}</p>
                  <p className="text-blue-600 font-semibold pt-1">✓ Lấy tự động từ Crop model khi thả giống.</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="font-bold text-slate-700 text-sm">2. Dữ liệu tôm hiện tại (Current Shrimp Count)</p>
                  <p className="text-slate-600">Ước tính hiện tại: <strong className="text-emerald-700 font-bold">{stats.harvestCount.toLocaleString()} con</strong></p>
                  <p className="text-slate-500">Trạng thái: {stats.isHarvested ? 'Đã thu hoạch chính thức' : 'Ước tính từ chài sinh khối định kỳ'}</p>
                  <p className="text-emerald-600 font-semibold pt-1">✓ Tái sử dụng logic tính toán sinh khối đã có sẵn.</p>
                </div>
              </div>

              {!viewOnly && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowHarvestModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Scale className="w-4 h-4" /> Cập nhật / Chốt số tôm thu hoạch
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      ) : null}

      {/* Harvest Count Update Modal Form */}
      {showHarvestModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Chốt Số Tôm Thu Hoạch</h3>
                  <p className="text-xs text-slate-300">Cập nhật số tôm khi thu hoạch để tính tỷ lệ sống</p>
                </div>
              </div>
              <button
                onClick={() => setShowHarvestModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateHarvestCount} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Số lượng tôm thu hoạch thực tế (con)
                </label>
                <input
                  type="number"
                  min="0"
                  value={actualHarvestCountInput}
                  onChange={(e) => setActualHarvestCountInput(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm transition-all"
                  placeholder="VD: 85000"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Hoặc Sản lượng (kg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={actualHarvestKgInput}
                    onChange={(e) => setActualHarvestKgInput(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm transition-all"
                    placeholder="VD: 1500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Và Kích cỡ (con/kg)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={actualHarvestSizeInput}
                    onChange={(e) => setActualHarvestSizeInput(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm transition-all"
                    placeholder="VD: 55"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowHarvestModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingHarvest}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submittingHarvest ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Chốt thu hoạch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
