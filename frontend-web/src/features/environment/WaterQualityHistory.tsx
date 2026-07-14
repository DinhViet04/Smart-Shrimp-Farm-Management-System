import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  FileText,
  Filter,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { waterQualityService } from '../../services/water-quality.service';

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
  no2: number;
  overallStatus: 'Optimal' | 'Warning' | 'Danger';
  note?: string;
  createdAt: string;
}

export default function WaterQualityHistory() {
  // ─── Filter States ─────────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // ─── Query/Pagination/Sorting States ───────────────────────────────────────
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ─── UI States ─────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Filter ponds by selected farm
  const filteredPonds = selectedFarmId
    ? ponds.filter((p) => p.farmId === selectedFarmId)
    : ponds;

  // ─── Fetch Master Data ─────────────────────────────────────────────────────
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

  // ─── Fetch History Records ─────────────────────────────────────────────────
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
        sort: sortOrder,
      });
      setRecords(data.content);
      setTotalElements(data.totalElements);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải lịch sử chất lượng nước');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, selectedPondId, fromDate, toDate, page, size, sortOrder]);

  useEffect(() => {
    fetchHistory();
  }, [page, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchHistory();
  };

  const handleReset = () => {
    setSelectedFarmId('');
    setSelectedPondId('');
    setFromDate('');
    setToDate('');
    setPage(0);
    setSortOrder('desc');
  };

  // Toggle sort order between asc and desc
  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const totalPages = Math.ceil(totalElements / size);

  // Status badge styling helper
  const getStatusBadge = (status: 'Optimal' | 'Warning' | 'Danger') => {
    switch (status) {
      case 'Optimal':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Tối ưu
          </span>
        );
      case 'Warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border border-amber-200 bg-amber-50 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Cảnh báo
          </span>
        );
      case 'Danger':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border border-rose-200 bg-rose-50 text-rose-700">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Nguy hiểm
          </span>
        );
      default:
        return null;
    }
  };

  // Format date helper
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500 tracking-tight">
              Lịch Sử Đo Môi Trường Nước
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Tra cứu và theo dõi các chỉ số nước của từng ao nuôi
            </p>
          </div>
        </div>
        <button
          onClick={fetchHistory}
          disabled={isLoading}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-2 text-sm font-semibold border border-slate-200"
          title="Làm mới danh sách"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Tải lại
        </button>
      </div>

      {/* ─── Search Filters ─────────────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
            <Filter className="w-4 h-4" />
            Bộ lọc tìm kiếm
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Farm dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Trang trại</label>
              <select
                value={selectedFarmId}
                onChange={(e) => {
                  setSelectedFarmId(e.target.value);
                  setSelectedPondId('');
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              >
                <option value="">Tất cả trang trại</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Pond dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Ao nuôi</label>
              <select
                value={selectedPondId}
                onChange={(e) => setSelectedPondId(e.target.value)}
                disabled={!selectedFarmId}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Tất cả ao nuôi</option>
                {filteredPonds.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Từ ngày</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Đến ngày</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            {/* Sorting toggle */}
            <button
              type="button"
              onClick={toggleSort}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider transition-all"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sắp xếp: {sortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}
            </button>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Đặt lại
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-blue-500/10 hover:shadow-blue-500/30"
              >
                <Search className="w-4 h-4" />
                Tìm kiếm
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ─── Content Section ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Đang truy vấn lịch sử...</p>
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center py-14 bg-red-50/50 rounded-3xl border border-red-100 p-6 text-center gap-3">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm font-bold text-red-800">{errorMsg}</p>
          <button
            onClick={fetchHistory}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-all"
          >
            Thử lại
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-center gap-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
            <Calendar className="w-8 h-8 text-slate-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-700">Không tìm thấy bản ghi</h3>
            <p className="text-slate-500 text-sm mt-1">Không có thông số chất lượng nước nào được tìm thấy khớp với bộ lọc.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Unified Responsive Card Grid Layout ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {records.map((r) => {
              const d = new Date(r.recordTime);
              const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
              const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

              return (
                <div
                  key={r.id}
                  onClick={() => {
                    setSelectedRecord(r);
                    setShowDetailDialog(true);
                  }}
                  className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1.5 duration-500 flex flex-col justify-between cursor-pointer overflow-hidden p-6 gap-4 group relative"
                >
                  {/* Card Header: Time & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>{timeStr}</span>
                      <span className="text-slate-300">•</span>
                      <span>{dateStr}</span>
                    </div>
                    {getStatusBadge(r.overallStatus)}
                  </div>

                  {/* Card Location Info */}
                  <div>
                    <h4 className="text-lg font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                      {r.pondName}
                    </h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {r.farmName}
                    </p>
                  </div>

                  {/* Symmetrical Param Matrix Grid (2x4 on desktop, 4x2 on mobile) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-100/50 shadow-inner">
                    {/* Temperature */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Nhiệt độ</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.temperature}<span className="text-[9px] font-medium text-slate-400 ml-0.5">°C</span>
                      </span>
                    </div>

                    {/* pH */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">pH</span>
                      <span className="text-xs font-black text-slate-700 mt-1">{r.ph}</span>
                    </div>

                    {/* DO */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">DO</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.dissolvedOxygen}<span className="text-[9px] font-medium text-slate-400 ml-0.5">mg/L</span>
                      </span>
                    </div>

                    {/* Salinity */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Độ mặn</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.salinity}<span className="text-[9px] font-medium text-slate-400 ml-0.5">ppt</span>
                      </span>
                    </div>

                    {/* Alkalinity */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Độ kiềm</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.alkalinity}<span className="text-[9px] font-medium text-slate-400 ml-0.5">mg/L</span>
                      </span>
                    </div>

                    {/* NH3 */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">NH3</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.nh3}<span className="text-[8px] font-medium text-slate-400 ml-0.5">mg/L</span>
                      </span>
                    </div>

                    {/* NO2 */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">NO2</span>
                      <span className="text-xs font-black text-slate-700 mt-1">
                        {r.no2}<span className="text-[8px] font-medium text-slate-400 ml-0.5">mg/L</span>
                      </span>
                    </div>

                    {/* Note Indicator */}
                    <div className="flex flex-col items-center justify-center p-1 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Ghi chú</span>
                      <span className="text-xs mt-1 text-slate-500">
                        {r.note ? '📝 Có' : '❌ Không'}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Detail Link indicator */}
                  <div className="flex items-center justify-end pt-3 border-t border-slate-100/50 mt-1">
                    <span className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <Eye className="w-3.5 h-3.5" /> Chi tiết đo lường
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Pagination Controls ────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">
                Hiển thị bản ghi từ <span className="font-bold text-slate-700">{page * size + 1}</span> đến{' '}
                <span className="font-bold text-slate-700">
                  {Math.min((page + 1) * size, totalElements)}
                </span>{' '}
                trong tổng số <span className="font-bold text-slate-700">{totalElements}</span> bản ghi
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-slate-700">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Detail Dialog / Modal overlay ─────────────────────────────────── */}
      {showDetailDialog && selectedRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden">
            {/* Header info */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest">
                  Chi tiết bản ghi nước
                </span>
                <h3 className="text-xl font-bold text-slate-800 mt-1">
                  {selectedRecord.pondName}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{selectedRecord.farmName}</p>
              </div>
              {getStatusBadge(selectedRecord.overallStatus)}
            </div>

            {/* Content fields details */}
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Thời gian đo</span>
                  <p className="text-sm font-bold text-slate-700 mt-1">{formatDate(selectedRecord.recordTime)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Thời gian tạo</span>
                  <p className="text-sm font-bold text-slate-700 mt-1">{formatDate(selectedRecord.createdAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Nhiệt độ</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{selectedRecord.temperature}°C</p>
                </div>
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">pH</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{selectedRecord.ph}</p>
                </div>
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Oxy hòa tan (DO)</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{selectedRecord.dissolvedOxygen} mg/L</p>
                </div>
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Độ mặn</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{selectedRecord.salinity} ppt</p>
                </div>
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Độ kiềm</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{selectedRecord.alkalinity} mg/L</p>
                </div>
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">NH3</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{selectedRecord.nh3} mg/L</p>
                </div>
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">NO2</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{selectedRecord.no2} mg/L</p>
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
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-colors text-sm shadow-lg shadow-blue-500/20"
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
