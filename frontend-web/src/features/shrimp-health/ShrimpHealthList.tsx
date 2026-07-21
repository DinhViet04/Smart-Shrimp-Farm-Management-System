/**
 * ShrimpHealthList.tsx
 *
 * List page for FE-21 — Shrimp Health History.
 * Card-grid layout with filters, pagination, and detail modal.
 * Adapted to Indigo theme for Technician and Teal for Farmer.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  HeartPulse,
  Filter,
  ArrowUpDown,
  RefreshCw,
  X,
} from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { shrimpHealthService } from '../../services/shrimp-health.service';
import type {
  ShrimpHealthHistoryRecord,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const HEALTH_STATUS_LABELS: Record<ShrimpHealthStatusType, string> = {
  NORMAL: 'Bình thường',
  LETHARGIC: 'Lờ đờ',
  EDGE_GATHERING: 'Tấp mé bờ',
  LOSS_OF_APPETITE: 'Bỏ ăn',
};

const SEVERITY_LABELS: Record<ShrimpSeverityType, string> = {
  NORMAL: 'Bình thường',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  SEVERE: 'Nặng',
};

// ─── Badge Helpers ────────────────────────────────────────────────────────────

function getHealthBadge(status: ShrimpHealthStatusType) {
  const map: Record<ShrimpHealthStatusType, { dot: string; bg: string }> = {
    NORMAL: { dot: 'bg-emerald-500', bg: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    LETHARGIC: { dot: 'bg-amber-400', bg: 'border-amber-200 bg-amber-50 text-amber-700' },
    EDGE_GATHERING: { dot: 'bg-orange-500', bg: 'border-orange-200 bg-orange-50 text-orange-700' },
    LOSS_OF_APPETITE: { dot: 'bg-red-500', bg: 'border-red-200 bg-red-50 text-red-700' },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {HEALTH_STATUS_LABELS[status]}
    </span>
  );
}

function getSeverityBadge(sev: ShrimpSeverityType) {
  const map: Record<ShrimpSeverityType, string> = {
    NORMAL: 'bg-emerald-500',
    MILD: 'bg-amber-400',
    MODERATE: 'bg-orange-500',
    SEVERE: 'bg-red-500',
  };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border border-slate-200 bg-slate-50 text-slate-700">
      <span className={`w-2 h-2 rounded-full ${map[sev]}`} />
      {SEVERITY_LABELS[sev]}
    </span>
  );
}

function getPercentageColor(pct: number): string {
  if (pct <= 25) return 'bg-emerald-500';
  if (pct <= 50) return 'bg-amber-400';
  if (pct <= 75) return 'bg-orange-500';
  return 'bg-red-500';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ShrimpHealthList() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try { setCurrentUser(JSON.parse(userStr)); } catch { /* ignore */ }
    }
  }, []);

  const isFarmer = currentUser?.role === 'FARMER';

  const themeText = isFarmer ? 'text-teal-600' : 'text-indigo-600';
  const themeTextHover = isFarmer ? 'group-hover:text-teal-600' : 'group-hover:text-indigo-600';
  const themeGradient = isFarmer
    ? 'from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600'
    : 'from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700';
  const themeGradientHeader = isFarmer
    ? 'from-teal-500 to-emerald-400'
    : 'from-indigo-600 to-purple-500';
  const themeTextGradientHeader = isFarmer
    ? 'from-teal-700 to-emerald-500'
    : 'from-indigo-900 via-indigo-800 to-purple-600';
  const themeShadowHeader = isFarmer ? 'shadow-teal-500/30' : 'shadow-indigo-500/30';
  const themeFocusRing = isFarmer
    ? 'focus:border-teal-500 focus:ring-teal-500/10'
    : 'focus:border-indigo-500 focus:ring-indigo-500/10';
  const themeSpinner = isFarmer ? 'border-t-teal-600' : 'border-t-indigo-600';
  const themeBg = isFarmer ? 'bg-teal-600' : 'bg-indigo-600';
  const themeBgHover = isFarmer ? 'hover:bg-teal-700' : 'hover:bg-indigo-700';
  const themeShadow = isFarmer ? 'shadow-teal-500/20' : 'shadow-indigo-500/20';

  // ─── Filter States ─────────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [selectedHealthStatus, setSelectedHealthStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // ─── Query/Pagination States ───────────────────────────────────────────────
  const [records, setRecords] = useState<ShrimpHealthHistoryRecord[]>([]);
  const [page, setPage] = useState(0);
  const [size] = useState(9);
  const [totalElements, setTotalElements] = useState(0);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ─── UI States ─────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ShrimpHealthHistoryRecord | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

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

  // ─── Fetch Records ─────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await shrimpHealthService.getHistory({
        farmId: selectedFarmId || undefined,
        pondId: selectedPondId || undefined,
        healthStatus: selectedHealthStatus || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        size,
        sort: sortOrder,
      });
      setRecords(data.content);
      setTotalElements(data.totalElements);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải lịch sử sức khỏe tôm');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, selectedPondId, selectedHealthStatus, fromDate, toDate, page, size, sortOrder]);

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
    setSelectedHealthStatus('');
    setFromDate('');
    setToDate('');
    setPage(0);
    setSortOrder('desc');
  };

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const totalPages = Math.ceil(totalElements / size);

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
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl ${isFarmer ? 'shadow-teal-900/5' : 'shadow-indigo-900/5'} border border-white/60`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 bg-gradient-to-br ${themeGradientHeader} rounded-2xl flex items-center justify-center shadow-lg ${themeShadowHeader}`}>
            <HeartPulse className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className={`text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${themeTextGradientHeader} tracking-tight`}>
              Lịch Sử Sức Khỏe Tôm
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Theo dõi và tra cứu tình trạng sức khỏe tôm của từng ao nuôi
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Farm */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Trang trại</label>
              <select
                value={selectedFarmId}
                onChange={(e) => {
                  setSelectedFarmId(e.target.value);
                  setSelectedPondId('');
                }}
                className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:bg-white ${themeFocusRing} transition-all`}
              >
                <option value="">Tất cả</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Pond */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Ao nuôi</label>
              <select
                value={selectedPondId}
                onChange={(e) => setSelectedPondId(e.target.value)}
                disabled={!selectedFarmId}
                className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:bg-white ${themeFocusRing} transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">Tất cả</option>
                {filteredPonds.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Health Status */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tình trạng</label>
              <select
                value={selectedHealthStatus}
                onChange={(e) => setSelectedHealthStatus(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:bg-white ${themeFocusRing} transition-all`}
              >
                <option value="">Tất cả</option>
                <option value="NORMAL">Bình thường</option>
                <option value="LETHARGIC">Lờ đờ</option>
                <option value="EDGE_GATHERING">Tấp mé bờ</option>
                <option value="LOSS_OF_APPETITE">Bỏ ăn</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Từ ngày</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={`w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:bg-white ${themeFocusRing} transition-all`}
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Đến ngày</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={`w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:bg-white ${themeFocusRing} transition-all`}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
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
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r ${themeGradient} text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${isFarmer ? 'shadow-teal-500/10 hover:shadow-teal-500/30' : 'shadow-indigo-500/10 hover:shadow-indigo-500/30'}`}
              >
                <Search className="w-4 h-4" />
                Tìm kiếm
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ─── Content ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm gap-4">
          <div className={`w-10 h-10 border-4 border-slate-200 ${themeSpinner} rounded-full animate-spin`} />
          <p className="text-sm font-semibold text-slate-500">Đang truy vấn dữ liệu...</p>
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
            <HeartPulse className="w-8 h-8 text-slate-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-700">Không tìm thấy bản ghi</h3>
            <p className="text-slate-500 text-sm mt-1">Không có bản ghi sức khỏe tôm nào khớp với bộ lọc.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Card Grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  className={`bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 hover:shadow-2xl ${isFarmer ? 'hover:shadow-teal-500/10' : 'hover:shadow-indigo-500/10'} hover:-translate-y-1.5 duration-500 flex flex-col justify-between cursor-pointer overflow-hidden p-6 gap-4 group relative`}
                >
                  {/* Header: Time & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                      <Calendar className={`w-3.5 h-3.5 ${isFarmer ? 'text-teal-500' : 'text-indigo-500'}`} />
                      <span>{timeStr}</span>
                      <span className="text-slate-300">•</span>
                      <span>{dateStr}</span>
                    </div>
                    {getHealthBadge(r.healthStatus)}
                  </div>

                  {/* Location */}
                  <div>
                    <h4 className={`text-lg font-black text-slate-800 ${themeTextHover} transition-colors`}>
                      {r.pondName}
                    </h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {r.farmName}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-100/50 shadow-inner">
                    {/* Severity */}
                    <div className="flex flex-col items-center justify-center p-2 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Mức độ</span>
                      <span className="mt-1">{getSeverityBadge(r.severity)}</span>
                    </div>

                    {/* Affected % */}
                    <div className="flex flex-col items-center justify-center p-2 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Ảnh hưởng</span>
                      <span className="text-sm font-black text-slate-700 mt-1">{r.affectedPercentage}%</span>
                      <div className="w-full h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getPercentageColor(r.affectedPercentage)}`}
                          style={{ width: `${Math.min(r.affectedPercentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Recorded By */}
                    <div className="flex flex-col items-center justify-center p-2 bg-white/50 rounded-xl border border-white/30">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Ghi nhận</span>
                      <span className="text-[10px] font-bold text-slate-600 mt-1 text-center truncate max-w-full" title={r.recordedBy}>
                        {r.recordedBy}
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end pt-3 border-t border-slate-100/50 mt-1">
                    <span className={`text-xs font-bold ${themeText} flex items-center gap-1 group-hover:translate-x-0.5 transition-transform`}>
                      <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Pagination ────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">
                Hiển thị <span className="font-bold text-slate-700">{page * size + 1}</span> đến{' '}
                <span className="font-bold text-slate-700">
                  {Math.min((page + 1) * size, totalElements)}
                </span>{' '}
                trong tổng số <span className="font-bold text-slate-700">{totalElements}</span>
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

      {/* ─── Detail Modal ─────────────────────────────────────────────────── */}
      {showDetailDialog && selectedRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden">
            {/* Close button */}
            <button
              onClick={() => {
                setShowDetailDialog(false);
                setSelectedRecord(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-start justify-between mb-5 pr-8">
              <div>
                <span className={`text-[10px] font-extrabold ${isFarmer ? 'text-teal-500' : 'text-indigo-500'} uppercase tracking-widest`}>
                  Chi tiết sức khỏe tôm
                </span>
                <h3 className="text-xl font-bold text-slate-800 mt-1">
                  {selectedRecord.pondName}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{selectedRecord.farmName}</p>
              </div>
              {getHealthBadge(selectedRecord.healthStatus)}
            </div>

            {/* Content */}
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {/* Time info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Thời gian ghi nhận</span>
                  <p className="text-sm font-bold text-slate-700 mt-1">{formatDate(selectedRecord.recordTime)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Người ghi nhận</span>
                  <p className="text-sm font-bold text-slate-700 mt-1">{selectedRecord.recordedBy}</p>
                </div>
              </div>

              {/* Health details */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tình trạng</span>
                  <div className="mt-1.5">{getHealthBadge(selectedRecord.healthStatus)}</div>
                </div>
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Mức độ</span>
                  <div className="mt-1.5">{getSeverityBadge(selectedRecord.severity)}</div>
                </div>
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tỷ lệ ảnh hưởng</span>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-2xl font-black text-slate-800">{selectedRecord.affectedPercentage}%</p>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getPercentageColor(selectedRecord.affectedPercentage)}`}
                        style={{ width: `${Math.min(selectedRecord.affectedPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Crop info */}
              <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Vụ nuôi</span>
                <p className="text-sm font-bold text-slate-700 mt-1">
                  Bắt đầu: {new Date(selectedRecord.cropStartDate).toLocaleDateString('vi-VN')}
                </p>
              </div>

              {/* Note */}
              <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú</span>
                <p className="text-sm font-semibold text-slate-700 mt-1 whitespace-pre-wrap">
                  {selectedRecord.note || 'Không có ghi chú.'}
                </p>
              </div>
            </div>

            {/* Footer */}
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
