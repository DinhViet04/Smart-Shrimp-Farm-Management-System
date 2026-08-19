import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Utensils,
  Calendar,
  X,
} from 'lucide-react';
import { farmService } from '../../services/farm.service';
import {
  feedingLogService,
  DEFAULT_FEEDING_SESSIONS,
  type DailyFeedingGroup,
} from '../../services/feeding-log.service';

interface Farm { id: string; name: string; }

export default function FeedingLogList() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [total, setTotal] = useState(0);
  const [data, setData] = useState<DailyFeedingGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected item for Detail Modal
  const [selectedGroup, setSelectedGroup] = useState<DailyFeedingGroup | null>(null);

  useEffect(() => {
    farmService.getAll().then(setFarms).catch(console.error);
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await feedingLogService.getAllGrouped({
        farmId: selectedFarmId || undefined,
        search: search || undefined,
        page,
        size,
      });
      setData(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error('Error fetching feeding logs:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFarmId, search, page, size]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / size);

  return (
    <div className="space-y-6">
      {/* ── Search & Filters ────────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-white/60 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Tìm theo tên ao nuôi hoặc trang trại..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium outline-none hover:bg-white focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Farm Filter */}
          <select
            value={selectedFarmId}
            onChange={(e) => {
              setSelectedFarmId(e.target.value);
              setPage(0);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none hover:bg-white focus:border-emerald-500 cursor-pointer"
          >
            <option value="">Tất cả trang trại</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setSearch('');
            setSelectedFarmId('');
            setPage(0);
          }}
          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center gap-2 text-xs font-bold"
        >
          <RotateCcw className="w-4 h-4" /> Làm mới
        </button>
      </div>

      {/* ── Data Table ─────────────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-white/60 shadow-lg shadow-slate-200/40 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Utensils className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">Chưa có nhật ký cho ăn nào</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Hãy chọn tab "Ghi nhận nhật ký" để tạo mới lịch ghi nhận 7 cử cho ăn mỗi ngày.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Ngày Cho Ăn</th>
                  <th className="py-4 px-6">Trang Trại</th>
                  <th className="py-4 px-6">Ao Nuôi</th>
                  <th className="py-4 px-6">Vụ Nuôi</th>
                  <th className="py-4 px-6 text-right">Tổng Thức Ăn (kg)</th>
                  <th className="py-4 px-6 text-center">Các Cử Cho Ăn</th>
                  <th className="py-4 px-6">Người Ghi Nhận</th>
                  <th className="py-4 px-6 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-emerald-900">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        {new Date(item.feedingDate).toLocaleDateString('vi-VN')}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600">{item.farmName}</td>
                    <td className="py-4 px-6 font-bold text-slate-800">{item.pondName}</td>
                    <td className="py-4 px-6 text-xs text-slate-500">
                      Ngày thả {new Date(item.cropStartDate).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-4 px-6 text-right font-black text-emerald-700 text-base">
                      {item.totalFeedKg.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kg</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-1">
                        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.completedSessions}/7 Xong
                        </span>
                        {item.delayedSessions > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                            {item.delayedSessions} Trễ
                          </span>
                        )}
                        {item.skippedSessions > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                            {item.skippedSessions} Bỏ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-600 font-medium">{item.createdBy}</td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => setSelectedGroup(item)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" /> Chi tiết 7 cử
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Hiển thị trang <span className="font-bold text-slate-800">{page + 1}</span> / {totalPages} ({total} bản ghi)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Read-Only Detail Modal ────────────────────────────────────── */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setSelectedGroup(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5 border-b pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  Chi Tiết Cho Ăn Ngày {new Date(selectedGroup.feedingDate).toLocaleDateString('vi-VN')}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedGroup.farmName} • <span className="font-bold text-slate-700">{selectedGroup.pondName}</span>
                </p>
              </div>
            </div>

            {/* 7 Session cards list */}
            <div className="space-y-3 mb-6">
              {DEFAULT_FEEDING_SESSIONS.map((defItem) => {
                const sessionLog = selectedGroup.sessions.find(
                  (s) => s.feedingSession === defItem.session,
                );

                return (
                  <div
                    key={defItem.session}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                        {defItem.session.replace('SESSION_', '')}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{defItem.label}</h4>
                        <p className="text-xs text-slate-400">Giờ thực tế: {sessionLog?.feedingTime || defItem.defaultTime}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-bold text-slate-600">{sessionLog?.feedProductName || 'Chưa ghi'}</p>
                        <p className="text-sm font-black text-emerald-700">
                          {sessionLog?.feedAmount ? `${sessionLog.feedAmount} kg` : '0 kg'}
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-extrabold ${
                          sessionLog?.feedingStatus === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sessionLog?.feedingStatus === 'DELAYED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {sessionLog?.feedingStatus === 'COMPLETED'
                          ? 'Hoàn thành'
                          : sessionLog?.feedingStatus === 'DELAYED'
                          ? 'Trễ cử'
                          : 'Bỏ cử'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary footer */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Tổng Lượng Thức Ăn</p>
                <p className="text-2xl font-black text-emerald-400">{selectedGroup.totalFeedKg.toFixed(1)} kg</p>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
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
