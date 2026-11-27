import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Utensils,
  Trash2,
  Pencil,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Waves,
  User,
} from 'lucide-react';
import { pondService, type OverviewFarm, type OverviewPond } from '../../services/pond.service';
import type { Crop } from '../../services/crop.service';
import {
  feedingLogService,
  DEFAULT_FEEDING_SESSIONS,
  type DailyFeedingGroup,
  type FeedingStatus,
} from '../../services/feeding-log.service';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { getErrorMessage } from '../../utils/errors';
import { formatDayVN, isToday, sessionInfo, roundKg } from './feeding-utils';

const PAGE_SIZE = 10;

/** Lưới cột cố định → các cột thẳng hàng, không bị khoảng trống lớn */
const ROW_GRID = 'grid-cols-[minmax(0,1fr)_auto_auto_16px] md:grid-cols-[minmax(140px,1.2fr)_minmax(150px,auto)_minmax(0,1.5fr)_96px_16px] items-center gap-x-4';

/** 45.25 → "45,25" (định dạng Việt Nam) */
const fmtKg = (n: number) => roundKg(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

const STATUS_STYLE: Record<FeedingStatus, { dot: string; text: string; label: string }> = {
  COMPLETED: { dot: 'bg-teal-500 border-teal-500', text: 'text-teal-700 bg-teal-50', label: 'Đã cho ăn' },
  DELAYED: { dot: 'bg-amber-400 border-amber-400', text: 'text-amber-800 bg-amber-50', label: 'Trễ cử' },
  SKIPPED: { dot: 'bg-white border-slate-300', text: 'text-slate-600 bg-slate-100', label: 'Bỏ cử' },
};

interface Props {
  /** Mở tab ghi cho ăn ở đúng ao + ngày để sửa */
  onEditDay: (pondId: string, date: string) => void;
}

export default function FeedingLogList({ onEditDay }: Props) {
  const [farms, setFarms] = useState<OverviewFarm[]>([]);
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  const [pondFilter, setPondFilter] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [data, setData] = useState<DailyFeedingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [groupToDelete, setGroupToDelete] = useState<DailyFeedingGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const listTopRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    pondService
      .getOverview()
      .then((o) => {
        setFarms(o.farms || []);
        setPonds(o.ponds || []);
        setCrops(o.crops || []);
      })
      .catch(console.error);
  }, []);

  const requestId = useRef(0);
  const fetchLogs = useCallback(
    async (silent = false) => {
      const req = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const res = await feedingLogService.getAllGrouped({ pondId: pondFilter || undefined, page, size: PAGE_SIZE });
        if (req !== requestId.current) return;
        setData(res.data);
        setTotal(res.total);
      } catch (err) {
        if (req === requestId.current) showToast(getErrorMessage(err) || 'Không tải được lịch sử cho ăn', 'error');
      } finally {
        if (req === requestId.current) setLoading(false);
      }
    },
    [pondFilter, page],
  );

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useRealtimeRefresh(['feeding-logs'], () => void fetchLogs(true));

  const activeCropIds = useMemo(() => new Set(crops.filter((c) => c.status === 'ACTIVE').map((c) => c.id)), [crops]);
  const showFarmName = farms.length > 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (p: number) => {
    setPage(p);
    setExpandedId(null);
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async () => {
    if (!groupToDelete) return;
    try {
      setIsDeleting(true);
      await feedingLogService.deleteDailyLog(groupToDelete.farmId, groupToDelete.pondId, groupToDelete.cropId, groupToDelete.feedingDate);
      setGroupToDelete(null);
      showToast('Đã xoá nhật ký và hoàn thức ăn lại vào kho', 'success');
      void fetchLogs(true);
    } catch (err) {
      showToast(getErrorMessage(err) || 'Không thể xoá nhật ký cho ăn', 'error');
    } finally {
      setIsDeleting(false);
    }
  };


  // Gom các ao theo ngày (dữ liệu đã sắp xếp ngày mới nhất trước)
  const days = useMemo(() => {
    const map = new Map<string, DailyFeedingGroup[]>();
    for (const g of data) {
      const key = g.feedingDate.slice(0, 10);
      map.set(key, [...(map.get(key) || []), g]);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      totalKg: items.reduce((s, g) => s + g.totalFeedKg, 0),
    }));
  }, [data]);

  return (
    <div className="w-full space-y-4" ref={listTopRef}>
      {/* ── Thanh lọc ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Waves className="w-4 h-4 text-teal-600" />
          <span className="font-semibold text-slate-600">Ao</span>
          <select
            value={pondFilter}
            onChange={(e) => {
              setPondFilter(e.target.value);
              setPage(0);
              setExpandedId(null);
            }}
            className="h-9 min-w-[200px] px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="">Tất cả ao</option>
            {ponds.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {showFarmName ? ` — ${farms.find((f) => f.id === p.farmId)?.name || ''}` : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-800 tabular-nums">{total.toLocaleString('vi-VN')}</span> bản ghi theo ngày
        </p>
      </div>

      {/* ── Danh sách ── */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 h-48 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 text-teal-600 animate-spin" /> Đang tải lịch sử cho ăn...
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center">
          <Utensils className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Chưa có nhật ký cho ăn</p>
          <p className="text-sm text-slate-500 mt-0.5">Vào tab "Ghi cho ăn" để ghi các cử hằng ngày.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <section key={day.date} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Tiêu đề ngày */}
              <header className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  {formatDayVN(day.date)}
                  {isToday(day.date) && (
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-teal-100 text-teal-800 whitespace-nowrap">Hôm nay</span>
                  )}
                </h3>
                <p className="text-sm text-slate-500 whitespace-nowrap">
                  {day.items.length} ao · <span className="font-semibold text-slate-800 tabular-nums">{fmtKg(day.totalKg)} kg</span>
                </p>
              </header>

              {/* Tiêu đề cột (màn hình rộng) */}
              <div className={`${ROW_GRID} hidden md:grid px-4 py-2 text-xs font-medium text-slate-500 border-b border-slate-100`}>
                <span>Ao nuôi</span>
                <span>Các cử</span>
                <span>Thức ăn</span>
                <span className="text-right">Tổng</span>
                <span />
              </div>

              <ul className="divide-y divide-slate-100">
                {day.items.map((g) => {
                  const expanded = expandedId === g.id;
                  const canEdit = activeCropIds.has(g.cropId);
                  const sessionMap = new Map(g.sessions.map((s) => [s.feedingSession, s]));
                  const fedCount = g.completedSessions + g.delayedSessions;
                  const recorded = g.sessions.length;
                  const feeds = [...new Set(g.sessions.filter((s) => s.feedingStatus !== 'SKIPPED').map((s) => s.feedProductName))];

                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : g.id)}
                        aria-expanded={expanded}
                        className={`${ROW_GRID} grid w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors cursor-pointer ${expanded ? 'bg-slate-50' : ''}`}
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-900 truncate">{g.pondName}</span>
                          {showFarmName && <span className="block text-xs text-slate-500 truncate">{g.farmName}</span>}
                        </span>

                        <span className="flex items-center gap-2">
                          <span className="flex items-center gap-1" aria-hidden>
                            {DEFAULT_FEEDING_SESSIONS.map((def) => {
                              const s = sessionMap.get(def.session);
                              return (
                                <span
                                  key={def.session}
                                  title={`${sessionInfo(def.session).name}: ${s ? `${STATUS_STYLE[s.feedingStatus].label}${s.feedAmount ? ` · ${fmtKg(s.feedAmount)} kg` : ''}` : 'Không ghi'}`}
                                  className={`w-2.5 h-2.5 rounded-full border ${s ? STATUS_STYLE[s.feedingStatus].dot : 'bg-slate-100 border-slate-200'}`}
                                />
                              );
                            })}
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                            {fedCount === 0 ? 'Bỏ cả ngày' : `${fedCount}/${recorded} cử`}
                          </span>
                        </span>

                        <span className="hidden md:block text-slate-600 truncate" title={feeds.join(', ')}>
                          {feeds.length ? feeds.join(', ') : '—'}
                        </span>

                        <span className={`text-right font-semibold tabular-nums ${g.totalFeedKg > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                          {fmtKg(g.totalFeedKg)} kg
                        </span>

                        <ChevronDown className={`w-4 h-4 text-slate-400 justify-self-end transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>

                      {expanded && (
                        <div className="px-4 pb-3 pt-1 bg-slate-50 space-y-3">
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                                  <th className="py-2 px-3 font-medium">Cử</th>
                                  <th className="py-2 px-3 font-medium">Giờ</th>
                                  <th className="py-2 px-3 font-medium">Thức ăn</th>
                                  <th className="py-2 px-3 font-medium text-right">Số kg</th>
                                  <th className="py-2 px-3 font-medium">Trạng thái</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {DEFAULT_FEEDING_SESSIONS.filter((def) => sessionMap.has(def.session)).map((def) => {
                                  const s = sessionMap.get(def.session)!;
                                  const info = sessionInfo(def.session);
                                  const skipped = s.feedingStatus === 'SKIPPED';
                                  return (
                                    <tr key={def.session} className={skipped ? 'text-slate-400' : 'text-slate-700'}>
                                      <td className="py-2 px-3 whitespace-nowrap">
                                        <span className="font-medium text-slate-800">{info.name}</span> <span className="text-slate-400">· {info.period}</span>
                                      </td>
                                      <td className="py-2 px-3 tabular-nums">{s.feedingTime}</td>
                                      <td className="py-2 px-3">{skipped ? '—' : s.feedProductName}</td>
                                      <td className="py-2 px-3 text-right tabular-nums font-medium">{skipped ? '—' : `${fmtKg(s.feedAmount)} kg`}</td>
                                      <td className="py-2 px-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[s.feedingStatus].text}`}>
                                          {STATUS_STYLE[s.feedingStatus].label}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <User className="w-3.5 h-3.5" /> Người ghi: <span className="font-medium text-slate-700">{g.createdBy}</span>
                            </p>
                            {canEdit ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setGroupToDelete(g)}
                                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:border-rose-300 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Xoá
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEditDay(g.pondId, g.feedingDate)}
                                  className="h-8 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> Sửa ngày này
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Vụ nuôi đã kết thúc — chỉ xem</span>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* ── Phân trang ── */}
      {!loading && totalPages > 1 && (
        <nav aria-label="Phân trang lịch sử cho ăn" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-500">
            Trang <span className="font-semibold text-slate-800">{page + 1}</span> / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => goToPage(page - 1)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:border-teal-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Mới hơn
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => goToPage(page + 1)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:border-teal-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              Cũ hơn <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </nav>
      )}

      {/* ── Xác nhận xoá ── */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h3 className="text-base font-semibold text-slate-900">Xoá nhật ký ngày này?</h3>
            <p className="text-sm text-slate-600 mt-1.5">
              {groupToDelete.pondName} · {formatDayVN(groupToDelete.feedingDate)}. {fmtKg(groupToDelete.totalFeedKg)} kg thức ăn sẽ được hoàn lại vào kho.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                disabled={isDeleting}
                className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Xoá
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed top-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
            toast.type === 'success' ? 'bg-white border-teal-200 text-teal-900' : 'bg-white border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-teal-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
