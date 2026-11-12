import { useState, useEffect, useMemo } from 'react';
import {
  FileDown,
  Search,
  RefreshCw,
  Building2,
  Waves,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  Table as TableIcon,
  LayoutGrid,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cropService, type Crop } from '../../services/crop.service';
import { pondService } from '../../services/pond.service';
import { groupCropsIntoCycles, type CropCycle, type FarmInfo, type PondInfo } from '../../utils/cropCycleGrouping';
import CropReportExportModal from '../../components/CropReportExportModal';
import CropDetailReportModal from '../../components/CropDetailReportModal';
import LoadingMotion from '../../components/LoadingMotion';
import { formatVND, formatNumber, formatDateVi } from '../../utils/cropReportExporter';

export default function CropReportsDashboard() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<FarmInfo[]>([]);
  const [ponds, setPonds] = useState<PondInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('HARVESTED'); // Mặc định hiển thị các vụ Đã thu hoạch để sẵn sàng xuất báo cáo
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal State
  const [exportCycle, setExportCycle] = useState<CropCycle | null>(null);
  const [previewCrop, setPreviewCrop] = useState<Crop | null>(null);

  // Load dữ liệu
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, cropsRes] = await Promise.all([
        pondService.getOverview(),
        cropService.getAll(),
      ]);
      setFarms(overview.farms as FarmInfo[]);
      setPonds(overview.ponds as PondInfo[]);
      setCrops(cropsRes);
    } catch (err: any) {
      console.error('Error loading crop report data:', err);
      setError(err?.message || 'Không thể tải dữ liệu vụ nuôi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Gom nhóm vụ nuôi thành các Chu kỳ vụ (Crop Cycles)
  const allCycles: CropCycle[] = useMemo(() => {
    if (!crops.length) return [];
    return groupCropsIntoCycles(crops, farms, ponds);
  }, [crops, farms, ponds]);

  // Lọc danh sách vụ nuôi theo điều kiện
  const filteredCycles = useMemo(() => {
    return allCycles.filter((cycle) => {
      // Lọc theo trang trại
      if (selectedFarmId && cycle.farmId !== selectedFarmId) {
        return false;
      }

      // Lọc theo trạng thái
      if (selectedStatus === 'HARVESTED' && cycle.status !== 'COMPLETED') {
        return false;
      }
      if (selectedStatus === 'ACTIVE' && cycle.status !== 'IN_PROGRESS') {
        return false;
      }

      // Lọc theo từ khóa tìm kiếm
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = cycle.name.toLowerCase().includes(query);
        const matchCode = cycle.code.toLowerCase().includes(query);
        const matchFarm = cycle.farmName.toLowerCase().includes(query);
        const matchPond = cycle.allCrops.some((c) =>
          (c.pond?.name || '').toLowerCase().includes(query),
        );
        if (!matchName && !matchCode && !matchFarm && !matchPond) {
          return false;
        }
      }

      return true;
    });
  }, [allCycles, selectedFarmId, selectedStatus, searchQuery]);

  // Thống kê tổng quan KPI
  const stats = useMemo(() => {
    const totalCount = allCycles.length;
    const completedCount = allCycles.filter((c) => c.status === 'COMPLETED').length;
    const inProgressCount = allCycles.filter((c) => c.status === 'IN_PROGRESS').length;
    const totalHarvestKg = allCycles.reduce((sum, c) => sum + (c.totals?.totalHarvestKg || 0), 0);
    const totalProfit = allCycles.reduce((sum, c) => sum + (c.totals?.totalProfit || 0), 0);

    return {
      totalCount,
      completedCount,
      inProgressCount,
      totalHarvestKg,
      totalProfit,
    };
  }, [allCycles]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Header Giới Thiệu Chức Năng ──────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -right-12 -bottom-16 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-12 w-48 h-48 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0 mt-0.5">
              <FileDown className="w-7 h-7 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Báo Cáo Vụ Nuôi
                </h2>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-400/25 text-cyan-100 border border-cyan-300/30">
                  Xuất PDF • Docs • Excel
                </span>
              </div>
              <p className="text-sm text-blue-100 font-medium mt-1.5 max-w-2xl leading-relaxed">
                Kho lưu trữ và xuất báo cáo tổng kết toàn diện của từng vụ nuôi. Xem lại lịch sử nghiệm thu, đánh giá kỹ thuật và tải về máy nhanh chóng dưới 3 định dạng chuẩn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border border-white/20 cursor-pointer shadow-sm"
              title="Làm mới dữ liệu vụ nuôi"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Đồng bộ dữ liệu</span>
            </button>
          </div>
        </div>

        {/* ── KPI Quick Bar ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-white/15 relative z-10">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15">
            <span className="text-[11px] font-bold text-cyan-200 uppercase tracking-wider block">
              Tổng số vụ nuôi
            </span>
            <span className="text-2xl font-black text-white mt-0.5 block">
              {stats.totalCount} <span className="text-xs font-normal text-blue-200">vụ</span>
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
              Vụ đã thu hoạch (Đầy đủ file)
            </span>
            <span className="text-2xl font-black text-white mt-0.5 block">
              {stats.completedCount} <span className="text-xs font-normal text-blue-200">vụ</span>
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15">
            <span className="text-[11px] font-bold text-cyan-200 uppercase tracking-wider block">
              Tổng sản lượng thu hoạch
            </span>
            <span className="text-2xl font-black text-white mt-0.5 block">
              {(stats.totalHarvestKg / 1000).toFixed(2)} <span className="text-xs font-normal text-blue-200">tấn ({formatNumber(stats.totalHarvestKg, 0)} kg)</span>
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15">
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider block">
              Tổng lợi nhuận lũy kế
            </span>
            <span className={`text-2xl font-black mt-0.5 block ${stats.totalProfit >= 0 ? 'text-white' : 'text-rose-200'}`}>
              {formatVND(stats.totalProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Bộ Lọc & Tìm Kiếm ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Ô tìm kiếm */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên vụ, mã vụ hoặc tên ao..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* Lọc Trang trại */}
          {farms.length > 1 && (
            <div className="relative min-w-[180px]">
              <select
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="">Tất cả trang trại ({farms.length})</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Lọc Trạng thái vụ */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedStatus('HARVESTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedStatus === 'HARVESTED'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✓ Đã thu hoạch ({stats.completedCount})
            </button>
            <button
              onClick={() => setSelectedStatus('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedStatus === 'ACTIVE'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🟢 Đang nuôi ({stats.inProgressCount})
            </button>
            <button
              onClick={() => setSelectedStatus('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedStatus === ''
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({stats.totalCount})
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border border-slate-200 p-1 rounded-xl self-end md:self-auto shrink-0 bg-slate-50">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            title="Xem dạng thẻ trực quan"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            title="Xem dạng bảng danh sách"
          >
            <TableIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Danh Sách Các Vụ Nuôi ─────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16">
          <LoadingMotion
            mode="card"
            title="Đang tải danh sách báo cáo vụ nuôi..."
            subtitle="Hệ thống đang đồng bộ dữ liệu nghiệm thu và tổng hợp số liệu..."
            color="blue"
          />
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 rounded-3xl border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-rose-800">{error}</h3>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      ) : filteredCycles.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <FileDown className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Không tìm thấy vụ nuôi nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Không có vụ nuôi nào khớp với bộ lọc hiện tại. Thử chọn lại trạng thái hoặc tìm kiếm từ khóa khác.
          </p>
          {(selectedFarmId || selectedStatus !== 'HARVESTED' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedFarmId('');
                setSelectedStatus('');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-all cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* DẠNG THẺ TRỰC QUAN (CARD GRID) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
          {filteredCycles.map((cycle) => {
            const isCompleted = cycle.status === 'COMPLETED';
            const isProfitPositive = (cycle.totals?.totalProfit || 0) >= 0;

            return (
              <div
                key={cycle.id}
                onClick={() => {
                  if (isCompleted) {
                    setExportCycle(cycle);
                  } else {
                    toast.error(
                      'Vụ nuôi đang trong quá trình nuôi. Cần các ao của vụ nuôi hoàn tất thu hoạch mới có thể xuất và tải báo cáo!',
                      { id: 'status-check-toast', duration: 4000 }
                    );
                  }
                }}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden flex flex-col group relative"
              >
                {/* Top Banner Gradient */}
                <div className="h-20 bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-600 p-4 sm:p-5 flex items-start justify-between relative overflow-hidden">
                  <div className="absolute -right-6 -bottom-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
                      <Waves className="w-6 h-6 text-cyan-200" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-black text-base sm:text-lg tracking-tight group-hover:text-cyan-200 transition-colors">
                          {cycle.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs">
                          {cycle.code}
                        </span>
                      </div>
                      <p className="text-xs text-blue-100 flex items-center gap-1.5 mt-0.5 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-cyan-200" />
                        {cycle.farmName}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="relative z-10">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shadow-xs ${
                        isCompleted
                          ? 'bg-emerald-400 text-slate-950 font-black'
                          : 'bg-amber-300 text-slate-950 font-black'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã hoàn thành
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" /> Đang nuôi
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Body Thông tin */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Timeline & Ponds Count */}
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>{formatDateVi(cycle.startDate)} ➔ {formatDateVi(cycle.endDate)}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold ml-1">
                        {cycle.durationDays} ngày nuôi
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-600 font-bold">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{cycle.totals.totalPondsCount} ao tham gia</span>
                    </div>
                  </div>

                  {/* 3 Metric Box */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Giống thả ban đầu
                      </span>
                      <span className="text-sm font-black text-slate-800 mt-0.5 block">
                        {formatNumber(cycle.totals.totalStockedShrimp)} <span className="text-[10px] font-normal text-slate-500">con</span>
                      </span>
                    </div>

                    <div className="bg-blue-50/70 rounded-2xl p-3 border border-blue-100 text-center">
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">
                        Tổng sản lượng
                      </span>
                      <span className="text-sm font-black text-blue-700 mt-0.5 block">
                        {cycle.totals.totalHarvestKg > 0 ? (
                          <>
                            {formatNumber(cycle.totals.totalHarvestKg, 0)}{' '}
                            <span className="text-[10px] font-normal text-blue-500">
                              kg (~{cycle.totals.totalHarvestTons} tấn)
                            </span>
                          </>
                        ) : (
                          '0 kg'
                        )}
                      </span>
                    </div>

                    <div className={`rounded-2xl p-3 border text-center ${
                      isProfitPositive ? 'bg-emerald-50/70 border-emerald-100' : 'bg-rose-50/70 border-rose-100'
                    }`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                        isProfitPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        Lợi nhuận ròng
                      </span>
                      <span className={`text-sm font-black mt-0.5 block ${
                        isProfitPositive ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {formatVND(cycle.totals.totalProfit)}
                      </span>
                    </div>
                  </div>

                  {/* Danh sách các ao trong vụ */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {cycle.allCrops.map((c) => {
                      const isPondHarvested = c.status === 'HARVESTED';
                      return (
                        <span
                          key={c.id}
                          onClick={(e) => {
                            if (!isCompleted || !isPondHarvested) {
                              e.stopPropagation();
                              toast.error(
                                `Ao nuôi ${c.pond?.name || ''} đang nuôi. Cần các ao của vụ nuôi hoàn tất thu hoạch mới có thể xuất báo cáo!`,
                                { id: 'status-check-toast', duration: 4000 }
                              );
                            }
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                            isCompleted && isPondHarvested
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-amber-50/80 text-amber-700 border-amber-200/80 cursor-pointer hover:bg-amber-100'
                          }`}
                          title={
                            isCompleted && isPondHarvested
                              ? `Ao ${c.pond?.name} (Đã thu hoạch)`
                              : `Ao ${c.pond?.name} đang nuôi - Cần hoàn tất thu hoạch mới xuất được báo cáo`
                          }
                        >
                          {c.pond?.name}
                        </span>
                      );
                    })}
                  </div>

                  {/* ── Action Bar: Nút tải báo cáo ──────────────────────────── */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                    {/* Nút chính: Tải Báo Cáo */}
                    {isCompleted ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExportCycle(cycle);
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer group-hover:scale-102"
                      >
                        <FileDown className="w-4 h-4 text-cyan-200" />
                        <span>Tải báo cáo vụ nuôi</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.error(
                            'Vụ nuôi đang trong quá trình nuôi. Cần các ao của vụ nuôi hoàn tất thu hoạch mới có thể xuất và tải báo cáo!',
                            { id: 'status-check-toast', duration: 4000 }
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold transition-all flex items-center gap-1.5 cursor-not-allowed border border-slate-200"
                        title="Vụ nuôi đang diễn ra, cần hoàn tất thu hoạch để xuất báo cáo"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Chưa thu hoạch</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DẠNG BẢNG DANH SÁCH (TABLE VIEW) */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4">Tên vụ & Mã vụ</th>
                  <th className="px-4 py-4">Trang trại & Ao</th>
                  <th className="px-4 py-4">Thời gian nuôi</th>
                  <th className="px-4 py-4 text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-right">Sản lượng (kg)</th>
                  <th className="px-4 py-4 text-right">Lợi nhuận ròng</th>
                  <th className="px-5 py-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCycles.map((cycle) => {
                  const isCompleted = cycle.status === 'COMPLETED';
                  const isProfitPositive = (cycle.totals?.totalProfit || 0) >= 0;

                  return (
                    <tr
                      key={cycle.id}
                      onClick={() => {
                        if (isCompleted) {
                          setExportCycle(cycle);
                        } else {
                          toast.error(
                            'Vụ nuôi đang trong quá trình nuôi. Cần các ao của vụ nuôi hoàn tất thu hoạch mới có thể xuất và tải báo cáo!',
                            { id: 'status-check-toast', duration: 4000 }
                          );
                        }
                      }}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-4 font-bold text-slate-800">
                        <div className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                          {cycle.name}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                          {cycle.code}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-700">{cycle.farmName}</div>
                        <div className="text-[11px] text-slate-500">
                          {cycle.allCrops.map((c) => c.pond?.name).join(', ')} ({cycle.totals.totalPondsCount} ao)
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-600 font-medium">
                        <div>{formatDateVi(cycle.startDate)} ➔ {formatDateVi(cycle.endDate)}</div>
                        <span className="text-[11px] font-bold text-blue-600">{cycle.durationDays} ngày (DOC)</span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                        >
                          {isCompleted ? '✓ Đã thu hoạch' : '🟢 Đang nuôi'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right font-black text-slate-800">
                        {cycle.totals.totalHarvestKg > 0 ? (
                          <>
                            <div>{formatNumber(cycle.totals.totalHarvestKg, 0)} kg</div>
                            <span className="text-[11px] font-normal text-slate-500">
                              ~ {cycle.totals.totalHarvestTons} tấn
                            </span>
                          </>
                        ) : (
                          '0 kg'
                        )}
                      </td>

                      <td className={`px-4 py-4 text-right font-black ${
                        isProfitPositive ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {formatVND(cycle.totals.totalProfit)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {isCompleted ? (
                            <button
                              type="button"
                              onClick={() => setExportCycle(cycle)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs flex items-center gap-1.5 text-xs cursor-pointer"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              <span>Tải file</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                toast.error(
                                  'Vụ nuôi đang trong quá trình nuôi. Cần các ao của vụ nuôi hoàn tất thu hoạch mới có thể xuất và tải báo cáo!',
                                  { id: 'status-check-toast', duration: 4000 }
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold transition-all border border-slate-200 flex items-center gap-1 text-xs cursor-not-allowed"
                              title="Chỉ tải báo cáo khi vụ đã hoàn thành thu hoạch"
                            >
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>Đang nuôi</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Tải Báo Cáo 3 Định Dạng (PDF, DOCS, EXCEL) ─────────────── */}
      {exportCycle && (
        <CropReportExportModal
          isOpen={!!exportCycle}
          cycle={exportCycle}
          crop={exportCycle.allCrops[0] || null}
          onClose={() => setExportCycle(null)}
          onOpenDetailedPreview={(crop) => {
            setExportCycle(null);
            setPreviewCrop(crop);
          }}
        />
      )}

      {/* ── Modal Xem Trước Báo Cáo Chi Tiết Trực Quan ──────────────────── */}
      {previewCrop && (
        <CropDetailReportModal
          isOpen={!!previewCrop}
          crop={previewCrop}
          onClose={() => setPreviewCrop(null)}
        />
      )}
    </div>
  );
}
