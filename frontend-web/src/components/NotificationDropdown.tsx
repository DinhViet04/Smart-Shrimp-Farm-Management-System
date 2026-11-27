import { useState, useRef, useEffect, useEffectEvent } from 'react';
import { createPortal } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { notificationService } from '../services/notification.service';
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Droplets,
  Utensils,
  Activity,
  Layers,
  X,
  Clock,
  HeartPulse,
  TrendingUp,
  Wind,
  Package,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';

export type NotificationLevel = 'INFO' | 'WARNING' | 'DANGER' | 'SUCCESS';

export type NotificationCategory =
  | 'ENVIRONMENT'
  | 'SHRIMP_HEALTH'
  | 'GROWTH'
  | 'FEEDING'
  | 'FIVE_T'
  | 'INCIDENT'
  | 'INCIDENT_ASSIGNMENT'
  | 'WEATHER'
  | 'DISASTER'
  | 'SYSTEM'
  | 'SUPPORT'
  | 'INVENTORY';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  category?: NotificationCategory;
  createdAt: string;
  isRead: boolean;
  targetLink?: string;
  pondId?: string;
  farmId?: string;
  pondName?: string;
  farmName?: string;
}

interface NotificationDropdownProps {
  themeColor?: 'blue' | 'indigo' | 'teal' | 'purple';
  onNavigateTab?: (tabName: string, config?: { farmId?: string; pondId?: string }) => void;
  /**
   * Trang đích có đang hiển thị trong menu của role không. Trả false (vd mục đã bị ẩn khỏi
   * thanh điều hướng) -> bấm thông báo chỉ mở khung chi tiết, KHÔNG chuyển sang trang đó.
   */
  canNavigateTo?: (tabName: string) => boolean;
}

/** Trang đích của một thông báo (dùng chung cho danh sách, toast realtime và khung chi tiết) */
function notificationTargetTab(item: { category?: string | null; title?: string | null }): string {
  const title = item.title?.toLowerCase() || '';
  if (item.category === 'INCIDENT' || item.category === 'INCIDENT_ASSIGNMENT' || title.includes('sự cố')) return 'Sự cố trang trại';
  if (item.category === 'GROWTH' || title.includes('tăng trưởng') || title.includes('kích cỡ') || title.includes('fcr')) return 'Theo dõi tăng trưởng';
  if (item.category === 'SHRIMP_HEALTH' || title.includes('sức khỏe tôm')) return 'Sức khỏe tôm';
  if (item.category === 'INVENTORY' || title.includes('vật tư') || /\bkho\b/.test(title)) return 'Quản Lý Kho';
  return 'Môi trường nước';
}


// Audio alert helper using Web Audio API
const playNotificationChime = (level: NotificationLevel = 'INFO') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (level === 'DANGER') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(580, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.38);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Autoplay blocked by browser policy
  }
};

const formatTimeAgo = (isoString: string) => {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
};

export default function NotificationDropdown({
  themeColor = 'blue',
  onNavigateTab,
  canNavigateTo,
}: NotificationDropdownProps) {
  // Có thể mở trang đích của thông báo này không (có handler + trang không bị ẩn)
  const canOpenTarget = (item: { category?: string | null; title?: string | null }) =>
    Boolean(onNavigateTab) && (canNavigateTo ? canNavigateTo(notificationTargetTab(item)) : true);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD' | 'ALERT'>('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('ssfm_notif_sound') !== 'false';
  });

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('ssfm_notif_sound', String(next));
      if (next) playNotificationChime('INFO');
      return next;
    });
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Fetch initial notifications
  const fetchNotifications = () => {
    notificationService.getNotifications()
      .then((data) => {
        setNotifications(data || []);
      })
      .catch((err) => console.error('Failed to fetch notifications', err));
  };

  const loadOnMount = useEffectEvent(() => {
    fetchNotifications();
  });
  useEffect(() => {
    loadOnMount();
  }, []);

  // Xử lý thông báo realtime: luôn đọc soundEnabled / onNavigateTab mới nhất
  // (trước đây handler giữ giá trị cũ, và socket bị kết nối lại mỗi khi onNavigateTab đổi)
  const handleIncomingNotification = useEffectEvent((notification: NotificationItem) => {
    const item = notification;
    setNotifications((prev) => [notification, ...prev.filter((n) => n.id !== notification.id)]);

    // Play audio chime if sound is enabled
    if (soundEnabled) {
      playNotificationChime(notification.level);
    }

    // Toast tương tác nhanh: Nhấn vào là chuyển thẳng tới ao
    const targetTab = notificationTargetTab(item);
    const isGrowth = targetTab === 'Theo dõi tăng trưởng';
    const isShrimpHealth = targetTab === 'Sức khỏe tôm';
    const canOpen = Boolean(notification.pondId) && canOpenTarget(item);
    const promptText = isGrowth
      ? '👉 Nhấn để xem ngay tăng trưởng & FCR ao này'
      : isShrimpHealth
        ? '👉 Nhấn để xem ngay sức khỏe tôm ao này'
        : '👉 Nhấn để xem ngay môi trường ao này';
    const iconEmoji = isGrowth ? '📈' : isShrimpHealth ? '🦐' : '🔔';

    toast((t) => (
      <div
        onClick={() => {
          toast.dismiss(t.id);
          if (notification.pondId && onNavigateTab) {
            onNavigateTab(targetTab, {
              farmId: notification.farmId,
              pondId: notification.pondId,
            });
          }
        }}
        className="cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{iconEmoji}</span>
          <span className="font-bold text-white text-sm">{notification.title}</span>
        </div>
        <p className="text-xs text-slate-300 mt-1 line-clamp-2">{notification.message}</p>
        {canOpen && (
          <div className="text-[11px] text-cyan-400 mt-1 font-semibold flex items-center gap-1">
            {promptText}
          </div>
        )}
      </div>
    ), {
      duration: 7000,
      style: {
        borderRadius: '16px',
        background: '#0f172a',
        color: '#fff',
        border: '1px solid #334155',
        maxWidth: '420px',
      },
    });
  });

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const socket = io(`${apiUrl}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('newNotification', (notification: NotificationItem) => {
      handleIncomingNotification(notification);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSelectedItem(null);
      }
    };

    if (isOpen) {
      fetchNotifications();
      document.addEventListener('mousedown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'UNREAD') return !item.isRead;
    if (activeFilter === 'ALERT') return item.level === 'DANGER' || item.level === 'WARNING';
    return true;
  });

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Optimistic UI update
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }

    try {
      await notificationService.deleteNotification(id);
    } catch (err) {
      console.error('Failed to delete notification', err);
      toast.error('Không thể xóa thông báo, vui lòng thử lại');
      fetchNotifications();
    }
  };

  const clearAllNotifications = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClearAll = async () => {
    const previous = [...notifications];
    setNotifications([]);
    setSelectedItem(null);
    setShowClearConfirm(false);

    try {
      setIsClearing(true);
      await notificationService.clearAllNotifications();
      toast.success('Đã xóa tất cả thông báo');
    } catch (err) {
      console.error('Failed to clear all notifications', err);
      toast.error('Không thể xóa tất cả thông báo');
      setNotifications(previous);
    } finally {
      setIsClearing(false);
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }
    // Nếu thông báo gắn với Ao nuôi cụ thể (môi trường nước, sức khỏe tôm hoặc tăng trưởng KTV vừa nhập),
    // chuyển trực tiếp tới trang Quản lý tương ứng của Ao đó
    // Trang đích bị ẩn với role này -> chỉ mở khung chi tiết, không chuyển trang
    if (item.pondId && onNavigateTab && canOpenTarget(item)) {
      setIsOpen(false);
      setSelectedItem(null);
      const targetTab = notificationTargetTab(item);
      onNavigateTab(targetTab, {
        farmId: item.farmId,
        pondId: item.pondId,
      });
      return;
    }
    setSelectedItem(item);
  };

  // Color theme mapping
  const colorMap = {
    blue: {
      btnHover: 'hover:text-blue-600 hover:bg-blue-50',
      activeBg: 'bg-blue-50 text-blue-600 ring-2 ring-blue-500/20',
      headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-700',
      badge: 'bg-blue-100 text-blue-800',
      tabActive: 'bg-blue-600 text-white shadow-sm',
      accentText: 'text-blue-600',
      underline: 'bg-blue-600',
      chip: 'bg-blue-600 text-white',
      softHover: 'hover:bg-blue-50 hover:text-blue-700',
      unreadBg: 'bg-blue-50/40',
      dot: 'bg-blue-500',
    },
    indigo: {
      btnHover: 'hover:text-indigo-600 hover:bg-indigo-50',
      activeBg: 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500/20',
      headerBg: 'bg-gradient-to-r from-indigo-600 to-purple-700',
      badge: 'bg-indigo-100 text-indigo-800',
      tabActive: 'bg-indigo-600 text-white shadow-sm',
      accentText: 'text-indigo-600',
      underline: 'bg-indigo-600',
      chip: 'bg-indigo-600 text-white',
      softHover: 'hover:bg-indigo-50 hover:text-indigo-700',
      unreadBg: 'bg-indigo-50/40',
      dot: 'bg-indigo-500',
    },
    teal: {
      btnHover: 'hover:text-teal-600 hover:bg-teal-50',
      activeBg: 'bg-teal-50 text-teal-600 ring-2 ring-teal-500/20',
      headerBg: 'bg-gradient-to-r from-teal-600 to-emerald-700',
      badge: 'bg-teal-100 text-teal-800',
      tabActive: 'bg-teal-600 text-white shadow-sm',
      accentText: 'text-teal-600',
      underline: 'bg-teal-600',
      chip: 'bg-teal-600 text-white',
      softHover: 'hover:bg-teal-50 hover:text-teal-700',
      unreadBg: 'bg-teal-50/40',
      dot: 'bg-teal-500',
    },
    purple: {
      btnHover: 'hover:text-purple-600 hover:bg-purple-50',
      activeBg: 'bg-purple-50 text-purple-600 ring-2 ring-purple-500/20',
      headerBg: 'bg-gradient-to-r from-purple-600 to-indigo-800',
      badge: 'bg-purple-100 text-purple-800',
      tabActive: 'bg-purple-600 text-white shadow-sm',
      accentText: 'text-purple-600',
      underline: 'bg-purple-600',
      chip: 'bg-purple-600 text-white',
      softHover: 'hover:bg-purple-50 hover:text-purple-700',
      unreadBg: 'bg-purple-50/40',
      dot: 'bg-purple-500',
    },
  }[themeColor];

  const getLevelIcon = (level: NotificationLevel, category?: NotificationCategory) => {
    if (category === 'ENVIRONMENT') {
      return <Droplets className="w-4 h-4 text-cyan-600" />;
    }
    if (category === 'SHRIMP_HEALTH') {
      return <HeartPulse className="w-4 h-4 text-rose-500" />;
    }
    if (category === 'GROWTH') {
      return <TrendingUp className="w-4 h-4 text-emerald-600" />;
    }
    if (category === 'FEEDING') {
      return <Utensils className="w-4 h-4 text-amber-600" />;
    }
    if (category === 'FIVE_T') {
      return <Layers className="w-4 h-4 text-indigo-600" />;
    }
    if (category === 'INCIDENT' || category === 'INCIDENT_ASSIGNMENT') {
      return <AlertTriangle className="w-4 h-4 text-rose-600" />;
    }
    if (category === 'WEATHER' || category === 'DISASTER') {
      return <Wind className="w-4 h-4 text-blue-600" />;
    }
    if (category === 'INVENTORY') {
      return <Package className="w-4 h-4 text-amber-600" />;
    }
    if (category === 'SUPPORT') {
      return <ShieldAlert className="w-4 h-4 text-indigo-600" />;
    }

    switch (level) {
      case 'DANGER':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'WARNING':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'INFO':
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  /** Màu nền ô biểu tượng + màu chữ nhãn mức độ */
  const levelStyle: Record<NotificationLevel, { iconBg: string; text: string }> = {
    DANGER: { iconBg: 'bg-rose-50 ring-rose-100', text: 'text-rose-600' },
    WARNING: { iconBg: 'bg-amber-50 ring-amber-100', text: 'text-amber-600' },
    SUCCESS: { iconBg: 'bg-emerald-50 ring-emerald-100', text: 'text-emerald-600' },
    INFO: { iconBg: 'bg-sky-50 ring-sky-100', text: 'text-sky-600' },
  };
  const styleOf = (level: NotificationLevel) => levelStyle[level] ?? levelStyle.INFO;

  /** Bỏ emoji & nhãn "[NGUY HIỂM]" ở đầu tiêu đề (mức độ đã hiển thị bằng nhãn riêng) */
  const cleanTitle = (title: string) =>
    (title || '')
      .replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '')
      .replace(/^\[(NGUY HIỂM|CẢNH BÁO|KHẨN CẤP|KHẨN|CHÚ Ý|LƯU Ý|THÔNG TIN|THÀNH CÔNG)\]\s*/i, '')
      .trim() || title;

  /** Nhóm thông báo theo ngày: Hôm nay / Hôm qua / Trước đó */
  const dayGroupOf = (iso: string) => {
    const d = new Date(iso);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const t = d.getTime();
    if (t >= startOfToday.getTime()) return 'Hôm nay';
    if (t >= startOfToday.getTime() - 86_400_000) return 'Hôm qua';
    return 'Trước đó';
  };

  const getLevelBadge = (level: NotificationLevel) => {
    switch (level) {
      case 'DANGER':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'WARNING':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'SUCCESS':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'INFO':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  const getLevelName = (level: NotificationLevel) => {
    switch (level) {
      case 'DANGER':
        return 'Khẩn cấp';
      case 'WARNING':
        return 'Cảnh báo';
      case 'SUCCESS':
        return 'Thành công';
      case 'INFO':
      default:
        return 'Thông tin';
    }
  };

  return (
    <div className="relative inline-block z-40" ref={containerRef}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Thông báo"
        className={`relative p-2.5 text-slate-500 rounded-full transition-all duration-200 focus:outline-none cursor-pointer ${isOpen ? colorMap.activeBg : `bg-slate-100/90 ${colorMap.btnHover}`
          }`}
      >
        <Bell className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'scale-110' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-extrabold text-white ring-2 ring-white shadow-sm animate-in zoom-in duration-150">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-[400px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right">
          {/* Header: tiêu đề + các nút thao tác dạng biểu tượng (không xuống dòng) */}
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-[15px] font-bold text-slate-900 whitespace-nowrap">Thông báo</h3>
              {unreadCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${colorMap.chip}`}>
                  {unreadCount} mới
                </span>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={toggleSound}
                title={soundEnabled ? 'Tắt âm thanh thông báo' : 'Bật âm thanh thông báo'}
                aria-label={soundEnabled ? 'Tắt âm thanh thông báo' : 'Bật âm thanh thông báo'}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  soundEnabled ? `${colorMap.accentText} hover:bg-slate-100` : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                title="Đánh dấu tất cả là đã đọc"
                aria-label="Đánh dấu tất cả là đã đọc"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={clearAllNotifications}
                disabled={notifications.length === 0}
                title="Xóa tất cả thông báo"
                aria-label="Xóa tất cả thông báo"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs lọc dạng gạch chân */}
          <div className="flex items-center gap-5 px-5 border-b border-slate-100" role="tablist">
            {[
              { key: 'ALL', label: 'Tất cả', count: notifications.length },
              { key: 'UNREAD', label: 'Chưa đọc', count: unreadCount },
              { key: 'ALERT', label: 'Cảnh báo', count: notifications.filter((n) => n.level === 'DANGER' || n.level === 'WARNING').length },
            ].map((tab) => {
              const active = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveFilter(tab.key as typeof activeFilter)}
                  className={`relative pb-2.5 pt-1 text-[13px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`min-w-[20px] px-1.5 py-px rounded-full text-[11px] font-semibold tabular-nums ${
                      active ? colorMap.chip : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                  {active && <span className={`absolute left-0 right-0 -bottom-px h-0.5 rounded-full ${colorMap.underline}`} />}
                </button>
              );
            })}
          </div>

          {/* Danh sách */}
          <div className="max-h-[440px] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
            {filteredNotifications.length === 0 ? (
              <div className="py-14 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-50 ring-1 ring-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {activeFilter === 'UNREAD' ? 'Bạn đã đọc hết thông báo' : activeFilter === 'ALERT' ? 'Không có cảnh báo nào' : 'Chưa có thông báo'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Thông báo mới sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              filteredNotifications.map((item, index) => {
                const group = dayGroupOf(item.createdAt);
                const showGroup = index === 0 || dayGroupOf(filteredNotifications[index - 1].createdAt) !== group;
                const style = styleOf(item.level);
                return (
                  <div key={item.id}>
                    {showGroup && (
                      <div className="sticky top-0 z-10 px-5 py-1.5 bg-slate-50/95 backdrop-blur-sm border-y border-slate-100 first:border-t-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {group}
                      </div>
                    )}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleItemClick(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleItemClick(item);
                        }
                      }}
                      className={`group relative flex gap-3 px-5 py-3.5 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 ${
                        !item.isRead ? colorMap.unreadBg : 'bg-white'
                      }`}
                    >
                      {/* Biểu tượng theo loại, nền theo mức độ */}
                      <div className={`w-9 h-9 rounded-full ring-1 flex items-center justify-center shrink-0 ${style.iconBg}`}>
                        {getLevelIcon(item.level, item.category)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <h4
                            className={`flex-1 min-w-0 text-[13px] leading-snug line-clamp-1 ${
                              !item.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                            }`}
                            title={item.title}
                          >
                            {cleanTitle(item.title)}
                          </h4>
                          {/* Thời gian (ẩn khi rê chuột để hiện nút thao tác) */}
                          <span className="text-[11px] text-slate-400 whitespace-nowrap pt-px group-hover:invisible">
                            {formatTimeAgo(item.createdAt)}
                          </span>
                          {!item.isRead && <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${colorMap.dot}`} aria-label="Chưa đọc" />}
                        </div>

                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{item.message}</p>

                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                          <span className={`font-semibold ${style.text}`}>{getLevelName(item.level)}</span>
                          {item.pondName && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 truncate">{item.pondName}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Thao tác nhanh khi rê chuột */}
                      <div className="absolute right-4 top-3 hidden group-hover:flex items-center gap-0.5 bg-white rounded-lg shadow-sm ring-1 ring-slate-200 p-0.5">
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={(e) => markAsRead(item.id, e)}
                            title="Đánh dấu đã đọc"
                            aria-label="Đánh dấu đã đọc"
                            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => deleteNotification(item.id, e)}
                          title="Xóa thông báo"
                          aria-label="Xóa thông báo"
                          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Quick Modal Preview when clicking a Notification */}
      {selectedItem &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    {getLevelIcon(selectedItem.level, selectedItem.category)}
                  </div>
                  <div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${getLevelBadge(selectedItem.level)}`}>
                      {getLevelName(selectedItem.level)}
                    </span>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(selectedItem.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  {cleanTitle(selectedItem.title)}
                </h3>
                {selectedItem.pondName && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    Đối tượng: {selectedItem.pondName}
                  </div>
                )}
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                  {selectedItem.message}
                </p>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => deleteNotification(selectedItem.id)}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa thông báo
                </button>
                <div className="flex items-center gap-2">
                  {(selectedItem.pondId || selectedItem.farmId || selectedItem.category === 'INCIDENT' || selectedItem.category === 'INCIDENT_ASSIGNMENT') && onNavigateTab && canOpenTarget(selectedItem) && (
                    <button
                      type="button"
                      onClick={() => {
                        const pondId = selectedItem.pondId;
                        const farmId = selectedItem.farmId;
                        const targetTab = notificationTargetTab(selectedItem);
                        setSelectedItem(null);
                        setIsOpen(false);
                        onNavigateTab(targetTab, { farmId, pondId });
                      }}
                      className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${selectedItem.category === 'GROWTH' || selectedItem.title?.toLowerCase().includes('tăng trưởng') || selectedItem.title?.toLowerCase().includes('kích cỡ')
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                          : selectedItem.category === 'SHRIMP_HEALTH' || selectedItem.title?.toLowerCase().includes('sức khỏe tôm')
                            ? 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500'
                            : selectedItem.category === 'INCIDENT' || selectedItem.category === 'INCIDENT_ASSIGNMENT' || selectedItem.title?.toLowerCase().includes('sự cố')
                              ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500'
                              : selectedItem.category === 'INVENTORY'
                                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500'
                                : 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500'
                        }`}
                    >
                      {(() => {
                        const target = notificationTargetTab(selectedItem);
                        const isIncident = target === 'Sự cố trang trại';
                        const isGrowth = target === 'Theo dõi tăng trưởng';
                        const isShrimpHealth = target === 'Sức khỏe tôm';
                        const isInventory = target === 'Quản Lý Kho';

                        if (isIncident) {
                          return (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Đến xử lý sự cố này
                            </>
                          );
                        }
                        if (isGrowth) {
                          return (
                            <>
                              <TrendingUp className="w-3.5 h-3.5" />
                              Đến theo dõi tăng trưởng & FCR ao này
                            </>
                          );
                        }
                        if (isShrimpHealth) {
                          return (
                            <>
                              <HeartPulse className="w-3.5 h-3.5" />
                              Đến quản lý sức khỏe tôm ao này
                            </>
                          );
                        }
                        if (isInventory) {
                          return (
                            <>
                              <Package className="w-3.5 h-3.5" />
                              Đến quản lý kho vật tư
                            </>
                          );
                        }
                        return (
                          <>
                            <Droplets className="w-3.5 h-3.5" />
                            Đến quản lý môi trường ao này
                          </>
                        );
                      })()}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showClearConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => !isClearing && setShowClearConfirm(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200"
            >
              <div className="h-1.5 bg-gradient-to-r from-rose-500 to-amber-500"></div>
              <div className="p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-3 shadow-inner">
                  <Trash2 className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-slate-800">Xóa tất cả thông báo?</h3>
                <p className="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">
                  Hành động này sẽ xóa toàn bộ danh sách thông báo hiện có của bạn và không thể khôi phục.
                </p>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClearAll}
                    disabled={isClearing}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isClearing ? 'Đang xóa...' : 'Xóa tất cả'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
