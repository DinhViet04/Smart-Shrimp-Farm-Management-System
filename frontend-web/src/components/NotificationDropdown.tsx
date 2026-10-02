import { useState, useRef, useEffect } from 'react';
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
  ExternalLink,
  X,
  Clock,
  HeartPulse,
  TrendingUp,
} from 'lucide-react';

export type NotificationLevel = 'INFO' | 'WARNING' | 'DANGER' | 'SUCCESS';

export type NotificationCategory =
  | 'ENVIRONMENT'
  | 'SHRIMP_HEALTH'
  | 'GROWTH'
  | 'FEEDING'
  | 'FIVE_T'
  | 'INCIDENT'
  | 'SYSTEM'
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
}


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
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD' | 'ALERT'>('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);

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

  useEffect(() => {
    fetchNotifications();
  }, []);

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

    socket.on('connect', () => {
      console.log('Connected to notifications WebSocket, socketId:', socket.id);
    });

    socket.on('newNotification', (notification: NotificationItem) => {
      console.log('Received realtime notification:', notification);
      setNotifications((prev) => [notification, ...prev.filter((n) => n.id !== notification.id)]);
      
      // Toast tương tác nhanh: Nhấn vào là chuyển thẳng tới ao
      const isGrowth = notification.category === 'GROWTH' || notification.title?.toLowerCase().includes('tăng trưởng') || notification.title?.toLowerCase().includes('kích cỡ') || notification.title?.toLowerCase().includes('fcr');
      const isShrimpHealth = notification.category === 'SHRIMP_HEALTH' || notification.title?.toLowerCase().includes('sức khỏe tôm');
      const targetTab = isGrowth ? 'Theo dõi tăng trưởng' : isShrimpHealth ? 'Sức khỏe tôm' : 'Môi trường nước';
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
          {notification.pondId && (
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

    return () => {
      socket.disconnect();
    };
  }, [onNavigateTab]);

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

  const clearAllNotifications = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tất cả thông báo không?')) {
      return;
    }
    const previous = [...notifications];
    setNotifications([]);
    setSelectedItem(null);

    try {
      await notificationService.clearAllNotifications();
      toast.success('Đã xóa tất cả thông báo');
    } catch (err) {
      console.error('Failed to clear all notifications', err);
      toast.error('Không thể xóa tất cả thông báo');
      setNotifications(previous);
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }
    // Nếu thông báo gắn với Ao nuôi cụ thể (môi trường nước, sức khỏe tôm hoặc tăng trưởng KTV vừa nhập),
    // chuyển trực tiếp tới trang Quản lý tương ứng của Ao đó
    if (item.pondId && onNavigateTab) {
      setIsOpen(false);
      setSelectedItem(null);
      const isGrowth = item.category === 'GROWTH' || item.title?.toLowerCase().includes('tăng trưởng') || item.title?.toLowerCase().includes('kích cỡ') || item.title?.toLowerCase().includes('fcr');
      const isShrimpHealth = item.category === 'SHRIMP_HEALTH' || item.title?.toLowerCase().includes('sức khỏe tôm');
      const targetTab = isGrowth ? 'Theo dõi tăng trưởng' : isShrimpHealth ? 'Sức khỏe tôm' : 'Môi trường nước';
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
    },
    indigo: {
      btnHover: 'hover:text-indigo-600 hover:bg-indigo-50',
      activeBg: 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500/20',
      headerBg: 'bg-gradient-to-r from-indigo-600 to-purple-700',
      badge: 'bg-indigo-100 text-indigo-800',
      tabActive: 'bg-indigo-600 text-white shadow-sm',
    },
    teal: {
      btnHover: 'hover:text-teal-600 hover:bg-teal-50',
      activeBg: 'bg-teal-50 text-teal-600 ring-2 ring-teal-500/20',
      headerBg: 'bg-gradient-to-r from-teal-600 to-emerald-700',
      badge: 'bg-teal-100 text-teal-800',
      tabActive: 'bg-teal-600 text-white shadow-sm',
    },
    purple: {
      btnHover: 'hover:text-purple-600 hover:bg-purple-50',
      activeBg: 'bg-purple-50 text-purple-600 ring-2 ring-purple-500/20',
      headerBg: 'bg-gradient-to-r from-purple-600 to-indigo-800',
      badge: 'bg-purple-100 text-purple-800',
      tabActive: 'bg-purple-600 text-white shadow-sm',
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
        className={`relative p-2.5 text-slate-500 rounded-full transition-all duration-200 focus:outline-none cursor-pointer ${
          isOpen ? colorMap.activeBg : `bg-slate-100/90 ${colorMap.btnHover}`
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
        <div className="absolute right-0 mt-3 w-80 sm:w-96 md:w-[420px] rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm leading-none flex items-center gap-1.5">
                  Thông báo
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white">
                      {unreadCount} mới
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Cập nhật tin tức & cảnh báo trang trại</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Đánh dấu tất cả đã đọc"
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đã đọc tất cả</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  title="Xóa tất cả thông báo"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center gap-1.5">
            {[
              { key: 'ALL', label: 'Tất cả', count: notifications.length },
              { key: 'UNREAD', label: 'Chưa đọc', count: unreadCount },
              {
                key: 'ALERT',
                label: 'Cảnh báo',
                count: notifications.filter((n) => n.level === 'DANGER' || n.level === 'WARNING').length,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === tab.key
                    ? colorMap.tabActive
                    : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100/80">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700">Không có thông báo nào</p>
                <p className="text-xs text-slate-400 mt-1">Bạn đã cập nhật tất cả thông tin mới nhất!</p>
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 transition-all duration-150 hover:bg-slate-50/90 cursor-pointer flex items-start gap-3 relative group ${
                    !item.isRead ? 'bg-blue-50/30' : 'bg-white'
                  }`}
                >
                  {/* Unread blue dot indicator */}
                  {!item.isRead && (
                    <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  )}

                  {/* Icon Box */}
                  <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5 group-hover:scale-105 transition-transform">
                    {getLevelIcon(item.level, item.category)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${getLevelBadge(item.level)}`}>
                        {getLevelName(item.level)}
                      </span>
                      {item.pondName && (
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.pondName}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>

                    <h4 className={`text-xs font-bold mt-1.5 leading-snug line-clamp-1 ${!item.isRead ? 'text-slate-900' : 'text-slate-700'}`}>
                      {item.title}
                    </h4>

                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Hover Delete Action */}
                  <button
                    type="button"
                    onClick={(e) => deleteNotification(item.id, e)}
                    title="Xóa thông báo"
                    className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] text-slate-400 font-medium">Hệ thống thông báo thông minh SSFM</span>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateTab('Thông báo');
                }}
                className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                Chi tiết
                <ExternalLink className="w-3 h-3" />
              </button>
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
                  {selectedItem.title}
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
                  {selectedItem.pondId && onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => {
                        const pondId = selectedItem.pondId;
                        const farmId = selectedItem.farmId;
                        const isGrowth = selectedItem.category === 'GROWTH' || selectedItem.title?.toLowerCase().includes('tăng trưởng') || selectedItem.title?.toLowerCase().includes('kích cỡ');
                        const isShrimpHealth = selectedItem.category === 'SHRIMP_HEALTH' || selectedItem.title?.toLowerCase().includes('sức khỏe tôm');
                        const targetTab = isGrowth ? 'Theo dõi tăng trưởng' : isShrimpHealth ? 'Sức khỏe tôm' : 'Môi trường nước';
                        setSelectedItem(null);
                        setIsOpen(false);
                        onNavigateTab(targetTab, { farmId, pondId });
                      }}
                      className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                        selectedItem.category === 'GROWTH' || selectedItem.title?.toLowerCase().includes('tăng trưởng') || selectedItem.title?.toLowerCase().includes('kích cỡ')
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                          : selectedItem.category === 'SHRIMP_HEALTH' || selectedItem.title?.toLowerCase().includes('sức khỏe tôm')
                            ? 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500'
                            : 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500'
                      }`}
                    >
                      {(() => {
                        const isGrowth = selectedItem.category === 'GROWTH' || selectedItem.title?.toLowerCase().includes('tăng trưởng') || selectedItem.title?.toLowerCase().includes('kích cỡ') || selectedItem.title?.toLowerCase().includes('fcr');
                        const isShrimpHealth = selectedItem.category === 'SHRIMP_HEALTH' || selectedItem.title?.toLowerCase().includes('sức khỏe tôm');
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
    </div>
  );
}
