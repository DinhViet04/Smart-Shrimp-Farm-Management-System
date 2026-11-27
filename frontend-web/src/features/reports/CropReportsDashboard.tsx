import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  FileDown,
  Search,
  RefreshCw,
  Building2,
  Waves,
  Calendar,
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
// Tải sau: chunk xuất báo cáo (xlsx/jszip) rất nặng, chỉ tải khi người dùng mở
const CropReportExportModal = lazy(() => import('../../components/CropReportExportModal'));
import CropDetailReportModal from '../../components/CropDetailReportModal';
import LoadingMotion from '../../components/LoadingMotion';
import { formatVND, formatNumber, formatDateVi } from '../../utils/cropReportExporter';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { getErrorMessage } from '../../utils/errors';

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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Modal State
  const [exportCycle, setExportCycle] = useState<CropCycle | null>(null);
  const [previewCrop, setPreviewCrop] = useState<Crop | null>(null);

  // Load dữ liệu
  const loadData = async (silent?: unknown) => {
    if (silent !== true) setLoading(true);
    setError(null);
    try {
      const [overview, cropsRes] = await Promise.all([
        pondService.getOverview(),
        cropService.getAll(),
      ]);
      setFarms(overview.farms as FarmInfo[]);
      setPonds(overview.ponds as PondInfo[]);
      setCrops(cropsRes);
    } catch (err) {
      console.error('Error loading crop report data:', err);
      setError(getErrorMessage(err) || 'Không thể tải dữ liệu vụ nuôi');
    } finally {
      setLoading(false);
    }
  };

  // Realtime: tự tải lại khi dữ liệu liên quan thay đổi trên server
  useRealtimeRefresh(['farms', 'ponds', 'crops', 'survival-rate', 'feeding-logs', 'shrimp-size'], () => {
    void loadData(true);
  });

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

  // ── Trang riêng: Tải báo cáo vụ nuôi (PDF, Word, Excel, ZIP) ──────────
  if (exportCycle) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-12">
        <Suspense fallback={null}>
        <CropReportExportModal
          asPage
          isOpen
          cycle={exportCycle}
          crop={exportCycle.allCrops[0] || null}
          onClose={() => setExportCycle(null)}
          onOpenDetailedPreview={(crop) => {
            setExportCycle(null);
            setPreviewCrop(crop);
          }}
        />
        </Suspense>
      </div>
    );
  }

  const notReadyToast = () =>
    toast.error('Vụ đang nuôi — cần thu hoạch xong tất cả ao mới tải được báo cáo.', {
      id: 'status-check-toast',
      duration: 4000,
    });
  const openCycle = (cycle: CropCycle) => (cycle.status === 'COMPLETED' ? setExportCycle(cycle) : notReadyToast());

  const statusTabs = [
    { id: 'HARVESTED', label: 'Đã thu hoạch', count: stats.completedCount },
    { id: 'ACTIVE', label: 'Đang nuôi', count: stats.inProgressCount },
    { id: '', label: 'Tất cả', count: stats.totalCount },
  ];

  const StatusBadge = ({ done }: { done: boolean }) => (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset whitespace-nowrap ${
        done ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {done ? 'Đã thu hoạch' : 'Đang nuôi'}
    </span>
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-12">
      {/* ── Tiêu đề + chỉ số ── */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Báo cáo vụ nuôi</h2>
              <p className="text-sm text-slate-500">Xuất PDF · Word · Excel</p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            title="Làm mới"
            aria-label="Làm mới"
            className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Tổng số vụ', value: `${stats.totalCount}`, unit: 'vụ' },
            { label: 'Đã thu hoạch', value: `${stats.completedCount}`, unit: 'vụ' },
            { label: 'Tổng sản lượng', value: (stats.totalHarvestKg / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 }), unit: 'tấn' },
            { label: 'Lợi nhuận lũy kế', value: formatVND(stats.totalProfit), unit: '', negative: stats.totalProfit < 0 },
          ].map((k) => (
            <div key={k.label} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-500">{k.label}</p>
              <p className={`text-xl font-semibold tabular-nums mt-0.5 ${k.negative ? 'text-rose-600' : 'text-slate-900'}`}>
                {k.value} {k.unit && <span className="text-sm font-normal text-slate-500">{k.unit}</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bộ lọc ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col md:flex-row md:items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm vụ, mã vụ, ao..."
            className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Xoá tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {farms.length > 1 && (
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">Tất cả trang trại</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}

        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg">
          {statusTabs.map((t) => (
            <button
              key={t.id || 'all'}
              onClick={() => setSelectedStatus(t.id)}
              className={`h-8 px-3 rounded-md text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                selectedStatus === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label} <span className="text-xs text-slate-400 tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg md:ml-auto">
          {(
            [
              { id: 'grid', icon: LayoutGrid, title: 'Dạng thẻ' },
              { id: 'table', icon: TableIcon, title: 'Dạng bảng' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              title={m.title}
              aria-label={m.title}
              className={`w-8 h-8 rounded-md flex items-center justify-center cursor-pointer ${
                viewMode === m.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <m.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Danh sách ── */}
      {loading ? (
        <div className="py-16">
          <LoadingMotion mode="card" title="Đang tải báo cáo vụ nuôi..." subtitle="" color="blue" />
        </div>
      ) : error ? (
        <div className="p-8 bg-white rounded-2xl border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <button onClick={loadData} className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium cursor-pointer">
            Thử lại
          </button>
        </div>
      ) : filteredCycles.length === 0 ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
          <FileDown className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700">Không có vụ nuôi phù hợp</p>
          {(selectedFarmId || selectedStatus !== 'HARVESTED' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedFarmId('');
                setSelectedStatus('');
                setSearchQuery('');
              }}
              className="h-8 px-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Dạng thẻ ── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCycles.map((cycle) => {
            const isCompleted = cycle.status === 'COMPLETED';
            const profit = cycle.totals?.totalProfit || 0;
            return (
              <div
                key={cycle.id}
                onClick={() => openCycle(cycle)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Waves className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900 truncate">
                        {cycle.name} <span className="text-xs font-normal text-slate-400">{cycle.code}</span>
                      </p>
                      <p className="text-sm text-slate-500 truncate flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" /> {cycle.farmName}
                      </p>
                    </div>
                  </div>
                  <StatusBadge done={isCompleted} />
                </div>

                <p className="text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateVi(cycle.startDate)} – {formatDateVi(cycle.endDate)}
                  <span className="text-slate-300">·</span> {cycle.durationDays} ngày
                  <span className="text-slate-300">·</span>
                  <Layers className="w-3.5 h-3.5" /> {cycle.totals.totalPondsCount} ao
                </p>

                <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/60">
                  {[
                    { label: 'Giống thả', value: `${formatNumber(cycle.totals.totalStockedShrimp)} con` },
                    { label: 'Sản lượng', value: `${formatNumber(cycle.totals.totalHarvestKg, 0)} kg` },
                    { label: 'Lợi nhuận', value: formatVND(profit), tone: profit >= 0 ? 'text-emerald-700' : 'text-rose-600' },
                  ].map((m) => (
                    <div key={m.label} className="px-3 py-2">
                      <p className="text-xs text-slate-500">{m.label}</p>
                      <p className={`text-sm font-semibold tabular-nums truncate ${m.tone || 'text-slate-900'}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1 flex-wrap min-w-0">
                    {cycle.allCrops.map((c) => {
                      const harvested = isCompleted && c.status === 'HARVESTED';
                      return (
                        <span
                          key={c.id}
                          title={harvested ? `${c.pond?.name}: đã thu hoạch` : `${c.pond?.name}: đang nuôi`}
                          className={`px-1.5 py-0.5 rounded text-xs ${harvested ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}
                        >
                          {c.pond?.name}
                        </span>
                      );
                    })}
                  </div>
                  {isCompleted ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExportCycle(cycle);
                      }}
                      className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <FileDown className="w-4 h-4" /> Tải báo cáo
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="h-8 px-3 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium flex items-center gap-1.5 shrink-0" title="Cần thu hoạch xong mới tải được báo cáo">
                      <Lock className="w-3.5 h-3.5" /> Chưa thu hoạch
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Dạng bảng ── */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-200 whitespace-nowrap">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Vụ nuôi</th>
                  <th className="px-4 py-2.5 font-medium">Trang trại · Ao</th>
                  <th className="px-4 py-2.5 font-medium">Thời gian</th>
                  <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                  <th className="px-4 py-2.5 font-medium text-right">Sản lượng</th>
                  <th className="px-4 py-2.5 font-medium text-right">Lợi nhuận</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCycles.map((cycle) => {
                  const isCompleted = cycle.status === 'COMPLETED';
                  const profit = cycle.totals?.totalProfit || 0;
                  return (
                    <tr key={cycle.id} onClick={() => openCycle(cycle)} className="hover:bg-slate-50 cursor-pointer">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">{cycle.name}</p>
                        <p className="text-xs text-slate-400">{cycle.code}</p>
                      </td>
                      <td className="px-4 py-2.5 max-w-[240px]">
                        <p className="text-slate-800 truncate">{cycle.farmName}</p>
                        <p className="text-xs text-slate-500 truncate">{cycle.allCrops.map((c) => c.pond?.name).join(', ')}</p>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <p className="text-slate-800 tabular-nums">
                          {formatDateVi(cycle.startDate)} – {formatDateVi(cycle.endDate)}
                        </p>
                        <p className="text-xs text-slate-500">{cycle.durationDays} ngày</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge done={isCompleted} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-medium text-slate-900">
                        {formatNumber(cycle.totals.totalHarvestKg, 0)} kg
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold ${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {formatVND(profit)}
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {isCompleted ? (
                          <button
                            type="button"
                            onClick={() => setExportCycle(cycle)}
                            title="Tải báo cáo"
                            className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileDown className="w-4 h-4" /> Tải
                          </button>
                        ) : (
                          <span title="Cần thu hoạch xong mới tải được báo cáo" className="inline-flex items-center text-slate-300">
                            <Lock className="w-4 h-4" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
