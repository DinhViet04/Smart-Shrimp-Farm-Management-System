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
  TrendingUp,
  Award,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { cropService, type Crop } from '../../services/crop.service';
import { survivalRateService, type SurvivalRateStats } from '../../services/survival-rate.service';
import GrowthHeaderTabs, { type GrowthTabType } from '../growth/GrowthHeaderTabs';

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
  onNavigateTab?: (tab: GrowthTabType) => void;
  initialFarmId?: string;
  initialPondId?: string;
  initialCropId?: string;
}

export default function SurvivalRateDashboard({ 
  viewOnly = false,
  onNavigateTab,
  initialFarmId,
  initialPondId,
  initialCropId,
}: SurvivalRateDashboardProps) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  const [selectedFarmId, setSelectedFarmId] = useState(initialFarmId || '');
  const [selectedPondId, setSelectedPondId] = useState(initialPondId || '');
  const [selectedCropId, setSelectedCropId] = useState(initialCropId || '');

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

  // Role check
  const currentUserRole = useMemo(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u).role : 'FARMER';
    } catch {
      return 'FARMER';
    }
  }, []);

  const canManageHarvest = !viewOnly && (currentUserRole === 'ADMIN' || currentUserRole === 'FARM_MANAGER');

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
        setSelectedFarmId((prev) => {
          if (initialFarmId && farmsData.some((f: Farm) => f.id === initialFarmId)) {
            return initialFarmId;
          }
          return prev || farmsData[0].id;
        });
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

  // When selected farm changes, update ponds & select pond
  useEffect(() => {
    if (farmPonds.length > 0) {
      if (initialPondId && farmPonds.some((p) => p.id === initialPondId)) {
        setSelectedPondId(initialPondId);
      } else {
        setSelectedPondId((prev) => {
          if (prev && farmPonds.some((p) => p.id === prev)) return prev;
          return farmPonds[0].id;
        });
      }
    } else {
      setSelectedPondId('');
      setCrops([]);
      setSelectedCropId('');
      setStats(null);
    }
  }, [selectedFarmId, farmPonds, initialPondId]);

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
      if (initialCropId && cropsData.some((c) => c.id === initialCropId)) {
        setSelectedCropId(initialCropId);
      } else {
        const activeCrops = cropsData.filter((c) => c.status === 'ACTIVE');
        if (activeCrops.length > 0) {
          setSelectedCropId(activeCrops[0].id);
        } else if (cropsData.length > 0) {
          setSelectedCropId(cropsData[0].id);
        } else {
          setSelectedCropId('');
          setStats(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách vụ nuôi');
      setCrops([]);
      setSelectedCropId('');
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [initialCropId]);

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

  // Gauge Colors based on standard
  const GAUGE_COLORS = useMemo(() => {
    if (!stats) return ['#10b981', '#CBD5E1'];
    if (stats.survivalRate >= (stats.targetSurvivalRate || 85)) {
      return ['#10b981', '#E2E8F0']; // Emerald for optimal
    } else if (stats.survivalRate >= 70) {
      return ['#F59E0B', '#E2E8F0']; // Amber for warning
    } else {
      return ['#EF4444', '#E2E8F0']; // Red for danger
    }
  }, [stats]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl pb-12">
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

      {/* Top Navigation */}
      <GrowthHeaderTabs
        activeTab="Theo dõi tỷ lệ sống"
        onTabChange={onNavigateTab}
        title="Theo Dõi Tỷ Lệ Sống & Hao Hụt"
        subtitle="Kiểm soát tỷ lệ sống thực tế so với mục tiêu và ghi nhận sản lượng thu hoạch vụ nuôi"
      />

      {/* Action Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Kiểm Soát Tỷ Lệ Sống Vụ Nuôi</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Công thức: Survival Rate (%) = (Số tôm thu hoạch / Số tôm thả ban đầu) × 100
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {canManageHarvest && selectedCropId && (
            <button
              onClick={() => setShowHarvestModal(true)}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs"
            >
              <Scale className="w-4 h-4" /> Ghi nhận số tôm thu hoạch
            </button>
          )}
          <button
            onClick={() => selectedCropId && fetchSurvivalData(selectedCropId)}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors border border-slate-200"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Farm Select */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-600" /> Trang Trại
          </label>
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Pond Select */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-teal-600" /> Ao Nuôi
          </label>
          <select
            value={selectedPondId}
            onChange={(e) => setSelectedPondId(e.target.value)}
            disabled={farmPonds.length === 0}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-all cursor-pointer disabled:opacity-50"
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
            <Calendar className="w-3.5 h-3.5 text-orange-600" /> Chọn Vụ Nuôi
          </label>
          <select
            value={selectedCropId}
            onChange={(e) => setSelectedCropId(e.target.value)}
            disabled={crops.length === 0}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl text-sm focus:bg-white focus:border-orange-500 outline-none transition-all cursor-pointer disabled:opacity-50"
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
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {loadingStats ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-slate-500 font-medium text-sm">Đang tải dữ liệu tỷ lệ sống...</p>
        </div>
      ) : !selectedCropId ? (
        <div className="text-center p-16 bg-white border border-slate-200/80 rounded-3xl shadow-xs">
          <Waves className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 mb-1">Ao nuôi chưa có vụ thả giống</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">Vui lòng khởi tạo vụ nuôi trong quản lý ao để theo dõi tỷ lệ sống.</p>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Gauge Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Đồng Hồ Tỷ Lệ Sống
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    stats.status === 'OPTIMAL'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : stats.status === 'WARNING'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {stats.status === 'OPTIMAL' ? '🟢 Đạt chuẩn 5T' : stats.status === 'WARNING' ? '🟡 Cần lưu ý' : '🔴 Báo động'}
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
                  <p className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">
                    {stats.isHarvested ? 'Tỷ lệ thu hoạch' : 'Tỷ lệ ước tính'}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Initial Stocking */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tôm Thả Ban Đầu</p>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {stats.initialStocking.toLocaleString()} <span className="text-xs font-normal text-slate-400">con</span>
                  </p>
                </div>
              </div>

              {/* Card 2: Harvest / Current Count */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {stats.isHarvested ? 'Số Tôm Thu Hoạch' : 'Tôm Hiện Tại'}
                    </p>
                    {stats.isHarvested && (
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">Đã chốt</span>
                    )}
                  </div>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">
                    {stats.harvestCount ? stats.harvestCount.toLocaleString() : '0'} <span className="text-xs font-normal text-slate-400">con</span>
                  </p>
                </div>
              </div>

              {/* Card 3: Crop Status */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trạng Thái Vụ</p>
                  <p className="text-base font-black text-purple-900 mt-1">
                    {stats.isHarvested ? 'Đã thu hoạch' : 'Đang nuôi'}
                  </p>
                </div>
              </div>
            </div>

            {/* Assessment Box & Detailed Data */}
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Đánh Giá Hiệu Suất Tăng Trưởng & Tỷ Lệ Sống
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {stats.survivalRate >= (stats.targetSurvivalRate || 85)
                    ? `Vụ nuôi tại ao ${stats.pondName} đạt tỷ lệ sống ${stats.survivalRate}%, vượt mức mục tiêu ${stats.targetSurvivalRate}%. Quản lý thức ăn và môi trường nước theo chuẩn 5T đang phát huy tối đa hiệu quả.`
                    : stats.survivalRate >= 70
                    ? `Tỷ lệ sống đạt ${stats.survivalRate}%, thấp hơn mục tiêu đề ra (${stats.targetSurvivalRate}%). Cần kiểm tra kỹ các chỉ số khí độc NH3, NO2 và chất lượng cữ ăn hàng ngày.`
                    : `Cảnh báo tỷ lệ sống ở mức báo động (${stats.survivalRate}%). Cần rà soát ngay tình trạng dịch bệnh hoặc số lượng tôm hao hụt qua nhật ký.`}
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cơ Sở Tính Toán Dữ Liệu
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="font-bold text-slate-700 block mb-1">1. Tôm thả ban đầu:</span>
                    <span className="text-slate-900 font-black">{stats.initialStocking.toLocaleString()} con</span>
                    <span className="text-slate-400 block mt-0.5">Ngày thả: {format(new Date(stats.startDate), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="font-bold text-slate-700 block mb-1">2. Tôm hiện tại / Thu hoạch:</span>
                    <span className="text-emerald-700 font-black">{stats.harvestCount ? stats.harvestCount.toLocaleString() : '0'} con</span>
                    <span className="text-slate-400 block mt-0.5">{stats.isHarvested ? 'Đã chốt thu hoạch chính thức' : 'Ước tính từ chài sinh khối định kỳ'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Harvest Modal */}
      {showHarvestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Scale className="w-5 h-5 text-orange-600" />
                Chốt Sản Lượng Thu Hoạch
              </h3>
              <button
                onClick={() => setShowHarvestModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateHarvestCount} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Cách 1: Nhập trực tiếp số lượng tôm thu hoạch (con)
                </label>
                <input
                  type="number"
                  placeholder="Ví dụ: 85,000"
                  value={actualHarvestCountInput}
                  onChange={(e) => setActualHarvestCountInput(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-orange-500"
                />
              </div>

              <div className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                --- Hoặc tính từ sản lượng & kích cỡ ---
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Sản lượng (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ví dụ: 1500"
                    value={actualHarvestKgInput}
                    onChange={(e) => setActualHarvestKgInput(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Kích cỡ (con/kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ví dụ: 50"
                    value={actualHarvestSizeInput}
                    onChange={(e) => setActualHarvestSizeInput(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowHarvestModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingHarvest}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingHarvest ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Xác nhận lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
