import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';

export type NotificationLevel = 'INFO' | 'WARNING' | 'DANGER' | 'SUCCESS';

export type NotificationCategory =
  | 'ENVIRONMENT'
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
  category: NotificationCategory;
  createdAt: string;
  isRead: boolean;
  targetLink?: string;
  pondName?: string;
}

interface NotificationDropdownProps {
  role?: string;
  themeColor?: 'blue' | 'indigo' | 'teal' | 'purple';
  onNavigateTab?: (tabName: string) => void;
}

const getRoleInitialNotifications = (role?: string): NotificationItem[] => {
  const now = new Date();
  const getAgo = (minutes: number) => {
    const d = new Date(now.getTime() - minutes * 60 * 1000);
    return d.toISOString();
  };

  switch (role) {
    case 'ADMIN':
      return [
        {
          id: 'adm-1',
          title: 'Yêu cầu phê duyệt trang trại mới',
          message: 'Trang trại "Hải Hà BioTech - Bạc Liêu" vừa được tạo và đang chờ kích hoạt tài nguyên.',
          level: 'WARNING',
          category: 'SYSTEM',
          createdAt: getAgo(12),
          isRead: false,
        },
        {
          id: 'adm-2',
          title: 'Sao lưu cơ sở dữ liệu hoàn tất',
          message: 'Hệ thống tự động sao lưu Postgres & Redis định kỳ lúc 00:00 thành công (Dung lượng: 1.2 GB).',
          level: 'SUCCESS',
          category: 'SYSTEM',
          createdAt: getAgo(180),
          isRead: false,
        },
        {
          id: 'adm-3',
          title: 'Người dùng mới đăng ký',
          message: 'Tài khoản kythuat.minh@gmail.com vừa hoàn tất đăng ký với vai trò Kỹ thuật viên.',
          level: 'INFO',
          category: 'SYSTEM',
          createdAt: getAgo(360),
          isRead: true,
        },
      ];

    case 'TECHNICIAN':
      return [
        {
          id: 'tech-1',
          title: 'Cảnh báo: Oxy hòa tan (DO) thấp',
          message: 'Ao Nuôi A1 có chỉ số DO giảm xuống 3.2 mg/L (ngưỡng an toàn >= 4.0 mg/L). Cần bật quạt nước khẩn cấp.',
          level: 'DANGER',
          category: 'ENVIRONMENT',
          pondName: 'Ao Nuôi A1',
          createdAt: getAgo(5),
          isRead: false,
        },
        {
          id: 'tech-2',
          title: 'Lịch đo mẫu tôm 5T định kỳ',
          message: 'Ao Ương 02 đạt mốc Ngày nuôi thứ 20 (DOC 20). Vui lòng bắt mẫu cân Gm và đếm Nđ.',
          level: 'WARNING',
          category: 'FIVE_T',
          pondName: 'Ao Ương 02',
          createdAt: getAgo(45),
          isRead: false,
        },
        {
          id: 'tech-3',
          title: 'Độ kiềm & pH Ao B3 ổn định',
          message: 'Kết quả đo kiểm lúc 07:00: pH = 7.8, Độ kiềm = 135 mg/L nằm trong ngưỡng tối ưu.',
          level: 'SUCCESS',
          category: 'ENVIRONMENT',
          pondName: 'Ao Nuôi B3',
          createdAt: getAgo(240),
          isRead: true,
        },
      ];

    case 'FARMER':
      return [
        {
          id: 'farm-1',
          title: 'Nhắc nhở: Cữ ăn Chiều (Cữ 3)',
          message: 'Đến giờ cho ăn Cữ 3 (14:00 - 15:30). Khẩu phần đề xuất: Ao A1: 42 kg, Ao A2: 38 kg.',
          level: 'INFO',
          category: 'FEEDING',
          createdAt: getAgo(15),
          isRead: false,
        },
        {
          id: 'farm-2',
          title: 'Cảnh báo thời tiết: Mưa giông lớn',
          message: 'Dự báo khu vực sắp có mưa lớn từ 16:30. Chú ý kiểm tra rãnh thoát nước mặt và rải vôi quanh bờ ao.',
          level: 'WARNING',
          category: 'ENVIRONMENT',
          createdAt: getAgo(60),
          isRead: false,
        },
        {
          id: 'farm-3',
          title: 'Đã xác nhận nhật ký cữ sáng',
          message: 'Kỹ thuật viên đã duyệt nhật ký cho ăn Cữ 1 (Sáng) của bạn.',
          level: 'SUCCESS',
          category: 'FEEDING',
          createdAt: getAgo(300),
          isRead: true,
        },
      ];

    case 'FARM_MANAGER':
    default:
      return [
        {
          id: 'mgr-1',
          title: 'Đến hạn đánh giá Vòng lặp 5T Care',
          message: 'Ao Nuôi A1 vừa kết thúc chu kỳ 5 ngày. Hệ thống đã tổng hợp FCR = 1.15 và tạo đề xuất lượng ăn mới.',
          level: 'WARNING',
          category: 'FIVE_T',
          pondName: 'Ao Nuôi A1',
          createdAt: getAgo(8),
          isRead: false,
        },
        {
          id: 'mgr-2',
          title: 'Cảnh báo tồn kho thức ăn số 2',
          message: 'Thức ăn CP 5002 chỉ còn 150 kg (dưới ngưỡng tối thiểu 300 kg). Cần tạo đơn nhập hàng.',
          level: 'DANGER',
          category: 'INVENTORY',
          createdAt: getAgo(75),
          isRead: false,
        },
        {
          id: 'mgr-3',
          title: 'Sự cố môi trường đã được xử lý',
          message: 'Kỹ thuật viên Nguyễn Văn A đã bổ sung vi sinh xử lý khí độc NH3 thành công tại Ao B2.',
          level: 'SUCCESS',
          category: 'INCIDENT',
          pondName: 'Ao Nuôi B2',
          createdAt: getAgo(190),
          isRead: true,
        },
        {
          id: 'mgr-4',
          title: 'Dự báo tỷ lệ sống tăng trưởng tốt',
          message: 'Ao Ương 01 đạt tỷ lệ sống ước tính 91.5%, vượt mục tiêu kế hoạch ban đầu (+2.5%).',
          level: 'INFO',
          category: 'FIVE_T',
          pondName: 'Ao Ương 01',
          createdAt: getAgo(420),
          isRead: true,
        },
      ];
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
  role = 'FARM_MANAGER',
  themeColor = 'blue',
  onNavigateTab,
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD' | 'ALERT'>('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    getRoleInitialNotifications(role),
  );
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  const markAsRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setSelectedItem(null);
  };

  const handleItemClick = (item: NotificationItem) => {
    markAsRead(item.id);
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

  const getLevelIcon = (level: NotificationLevel, category: NotificationCategory) => {
    if (category === 'ENVIRONMENT') {
      return <Droplets className="w-4 h-4 text-cyan-600" />;
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
    <div className="relative inline-block" ref={containerRef}>
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
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
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

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
              >
                Đã hiểu (Đóng)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
