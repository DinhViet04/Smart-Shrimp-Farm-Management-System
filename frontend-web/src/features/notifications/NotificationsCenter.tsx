import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Droplets,
  HeartPulse,
  TrendingUp,
  Utensils,
  Layers,
  Wind,
  Package,
  ShieldAlert,
  Trash2,
  CheckCheck,
  Search,
  X,
  Clock,
  ArrowRight,
  RefreshCw,
  Filter,
  Check,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { notificationService } from '../../services/notification.service';
import LoadingMotion from '../../components/LoadingMotion';
import { useNow } from '../../hooks/useNow';

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
  | 'INVENTORY'
  | 'SYSTEM'
  | 'SUPPORT';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  category?: NotificationCategory;
  createdAt: string;
  isRead: boolean;
  pondId?: string;
  farmId?: string;
  pondName?: string;
  farmName?: string;
}

// Determine category helper
const inferCategory = (item: NotificationItem): NotificationCategory => {
  if (item.category) return item.category;
  const lowerTitle = (item.title || '').toLowerCase();
  const lowerMsg = (item.message || '').toLowerCase();

  if (lowerTitle.includes('bão') || lowerTitle.includes('mưa') || lowerTitle.includes('nắng nóng') || lowerTitle.includes('thời tiết') || lowerTitle.includes('lốc xoáy')) {
    return 'WEATHER';
  }
  if (lowerTitle.includes('sự cố') || lowerMsg.includes('báo cáo sự cố') || lowerMsg.includes('phân công')) {
    return 'INCIDENT';
  }
  if (lowerTitle.includes('tăng trưởng') || lowerTitle.includes('kích cỡ') || lowerTitle.includes('fcr') || lowerTitle.includes('sinh khối')) {
    return 'GROWTH';
  }
  if (lowerTitle.includes('sức khỏe') || lowerTitle.includes('báo động đỏ') || lowerMsg.includes('tấp mé') || lowerMsg.includes('bỏ ăn')) {
    return 'SHRIMP_HEALTH';
  }
  if (lowerTitle.includes('môi trường') || lowerMsg.includes('do') || lowerMsg.includes('ph') || lowerMsg.includes('khí độc')) {
    return 'ENVIRONMENT';
  }
  if (lowerTitle.includes('thức ăn') || lowerMsg.includes('cữ ăn') || lowerTitle.includes('nhật ký cho ăn')) {
    return 'FEEDING';
  }
  if (lowerTitle.includes('kho') || lowerMsg.includes('tồn kho') || lowerTitle.includes('vật tư')) {
    return 'INVENTORY';
  }
  if (lowerTitle.includes('hỗ trợ') || lowerMsg.includes('ticket')) {
    return 'SUPPORT';
  }
  return 'SYSTEM';
};

interface NotificationsCenterProps {
  role?: 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER';
  onNavigateTab?: (tabName: string, config?: { farmId?: string; pondId?: string }) => void;
}

export default function NotificationsCenter({
  role = 'FARM_MANAGER',
  onNavigateTab,
}: NotificationsCenterProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const now = useNow(60_000); // cập nhật nhãn "x phút trước" mỗi phút
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'DANGER' | 'WARNING' | 'INFO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Fetch notifications from server
  const loadNotifications = async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      else setIsRefreshing(true);
      const data = await notificationService.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load notifications', err);
      toast.error('Không thể tải danh sách thông báo');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  // Listen to WebSocket realtime updates
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

    socket.on('newNotification', (newNotif: NotificationItem) => {
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Format relative time helper
  const formatTimeAgo = (isoString: string) => {
    const diffMs = now - new Date(isoString).getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  // Get icon by category & level
  const getCategoryIcon = (category: NotificationCategory, level: NotificationLevel) => {
    switch (category) {
      case 'ENVIRONMENT':
        return <Droplets className="w-5 h-5 text-cyan-600" />;
      case 'SHRIMP_HEALTH':
        return <HeartPulse className="w-5 h-5 text-rose-600" />;
      case 'GROWTH':
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case 'FEEDING':
        return <Utensils className="w-5 h-5 text-amber-600" />;
      case 'FIVE_T':
        return <Layers className="w-5 h-5 text-indigo-600" />;
      case 'INCIDENT':
      case 'INCIDENT_ASSIGNMENT':
        return <AlertTriangle className="w-5 h-5 text-rose-600" />;
      case 'WEATHER':
      case 'DISASTER':
        return <Wind className="w-5 h-5 text-blue-600" />;
      case 'INVENTORY':
        return <Package className="w-5 h-5 text-amber-600" />;
      case 'SUPPORT':
        return <ShieldAlert className="w-5 h-5 text-indigo-600" />;
      case 'SYSTEM':
      default:
        if (level === 'DANGER') return <AlertTriangle className="w-5 h-5 text-rose-600" />;
        if (level === 'WARNING') return <AlertCircle className="w-5 h-5 text-amber-600" />;
        if (level === 'SUCCESS') return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  // Category labels for filter
  const categoryOptions = [
    { key: 'ALL', label: 'Tất cả danh mục' },
    { key: 'ENVIRONMENT', label: 'Môi trường nước', icon: Droplets },
    { key: 'SHRIMP_HEALTH', label: 'Sức khỏe tôm', icon: HeartPulse },
    { key: 'GROWTH', label: 'Tăng trưởng & FCR', icon: TrendingUp },
    { key: 'INCIDENT', label: 'Sự cố trang trại', icon: AlertTriangle },
    { key: 'WEATHER', label: 'Thiên tai & Thời tiết', icon: Wind },
    { key: 'INVENTORY', label: 'Vật tư & Kho', icon: Package },
    { key: 'SYSTEM', label: 'Hệ thống & Nhân sự', icon: Bell },
  ];

  // Actions
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      );
      if (selectedNotification?.id === id) {
        setSelectedNotification((prev) => (prev ? { ...prev, isRead: true } : null));
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể cập nhật trạng thái');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      toast.success('Đã đánh dấu tất cả là đã đọc');
    } catch (err) {
      console.error(err);
      toast.error('Thao tác thất bại');
    }
  };

  const handleDeleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const previous = [...notifications];
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (selectedNotification?.id === id) {
      setSelectedNotification(null);
    }

    try {
      await notificationService.deleteNotification(id);
      toast.success('Đã xóa thông báo');
    } catch (err) {
      console.error(err);
      toast.error('Không thể xóa thông báo');
      setNotifications(previous);
    }
  };

  const handleConfirmClearAll = async () => {
    const previous = [...notifications];
    setNotifications([]);
    setSelectedNotification(null);
    setShowClearConfirm(false);

    try {
      setIsClearing(true);
      await notificationService.clearAllNotifications();
      toast.success('Đã xóa toàn bộ thông báo');
    } catch (err) {
      console.error(err);
      toast.error('Không thể xóa toàn bộ');
      setNotifications(previous);
    } finally {
      setIsClearing(false);
    }
  };

  // Direct context navigation
  const handleNavigateFromItem = (item: NotificationItem) => {
    if (!onNavigateTab) return;
    if (!item.isRead) {
      handleMarkAsRead(item.id);
    }

    const cat = inferCategory(item);
    const config = {
      farmId: item.farmId,
      pondId: item.pondId,
    };

    if (cat === 'INCIDENT' || cat === 'INCIDENT_ASSIGNMENT') {
      onNavigateTab('Sự cố trang trại', config);
    } else if (cat === 'GROWTH') {
      onNavigateTab('Theo dõi tăng trưởng', config);
    } else if (cat === 'SHRIMP_HEALTH') {
      onNavigateTab('Sức khỏe tôm', config);
    } else if (cat === 'ENVIRONMENT') {
      onNavigateTab('Môi trường nước', config);
    } else if (cat === 'INVENTORY') {
      onNavigateTab(role === 'FARMER' ? 'Kho thức ăn' : 'Quản Lý Kho', config);
    } else if (cat === 'FEEDING') {
      onNavigateTab(role === 'FARMER' ? 'Nhật ký cho ăn' : 'Quản lý Ao/Vụ', config);
    } else {
      if (item.pondId) {
        onNavigateTab('Môi trường nước', config);
      } else if (item.farmId) {
        onNavigateTab('Quản lý Trang Trại', config);
      }
    }
    setSelectedNotification(null);
  };

  // Filtered and searched notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // 1. Severity filter
      if (severityFilter === 'DANGER' && item.level !== 'DANGER') return false;
      if (severityFilter === 'WARNING' && item.level !== 'WARNING') return false;
      if (severityFilter === 'INFO' && item.level !== 'INFO' && item.level !== 'SUCCESS') return false;

      // 2. Read status filter
      if (statusFilter === 'UNREAD' && item.isRead) return false;
      if (statusFilter === 'READ' && !item.isRead) return false;

      // 3. Category filter
      if (categoryFilter !== 'ALL') {
        const cat = inferCategory(item);
        if (cat !== categoryFilter) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = (item.title || '').toLowerCase().includes(q);
        const inMessage = (item.message || '').toLowerCase().includes(q);
        const inPond = (item.pondName || '').toLowerCase().includes(q);
        const inFarm = (item.farmName || '').toLowerCase().includes(q);
        if (!inTitle && !inMessage && !inPond && !inFarm) return false;
      }

      return true;
    });
  }, [notifications, severityFilter, statusFilter, categoryFilter, searchQuery]);

  // Counters
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const dangerCount = notifications.filter((n) => n.level === 'DANGER').length;
  const warningCount = notifications.filter((n) => n.level === 'WARNING').length;
  const infoCount = notifications.filter((n) => n.level === 'INFO' || n.level === 'SUCCESS').length;

  if (isLoading) {
    return (
      <div className="py-16">
        <LoadingMotion
          mode="page"
          title="Đang tải Trung tâm thông báo..."
          subtitle="Hệ thống đang đồng bộ danh mục thông báo và cảnh báo mới nhất..."
          icon={<Bell className="w-12 h-12 text-blue-600" />}
          color="blue"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Page Title & Main Actions */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Trung Tâm Thông Báo & Cảnh Báo
              </h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Theo dõi và quản lý toàn bộ cảnh báo thời gian thực về môi trường, sức khỏe, tăng trưởng và sự cố trang trại
            </p>
          </div>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => loadNotifications(false)}
            disabled={isRefreshing}
            className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden md:inline">Làm mới</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="px-4 py-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200"
            >
              <CheckCheck className="w-4 h-4" />
              Đánh dấu tất cả đã đọc
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200"
            >
              <Trash2 className="w-4 h-4" />
              Xóa tất cả
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        {/* Top: Search & Status Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề, ao nuôi, trang trại hoặc nội dung cảnh báo..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Tabs (All / Unread / Read) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl self-start md:self-auto">
            {(
              [
                { key: 'ALL', label: 'Tất cả' },
                { key: 'UNREAD', label: `Chưa đọc (${unreadCount})` },
                { key: 'READ', label: 'Đã đọc' },
              ] as const
            ).map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setStatusFilter(st.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity Tabs (FE-51 Requirement) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSeverityFilter('ALL')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
              severityFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Tất cả mức độ
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200/50 text-current">
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSeverityFilter('DANGER')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
              severityFilter === 'DANGER'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/20'
                : 'bg-rose-50/60 text-rose-700 border-rose-200 hover:bg-rose-100/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Khẩn cấp (Danger)
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${severityFilter === 'DANGER' ? 'bg-white/20' : 'bg-rose-200 text-rose-800'}`}>
              {dangerCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSeverityFilter('WARNING')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
              severityFilter === 'WARNING'
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20'
                : 'bg-amber-50/60 text-amber-700 border-amber-200 hover:bg-amber-100/60'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Cảnh báo (Warning)
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${severityFilter === 'WARNING' ? 'bg-white/20' : 'bg-amber-200 text-amber-800'}`}>
              {warningCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSeverityFilter('INFO')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
              severityFilter === 'INFO'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20'
                : 'bg-blue-50/60 text-blue-700 border-blue-200 hover:bg-blue-100/60'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            Thông tin (Info)
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${severityFilter === 'INFO' ? 'bg-white/20' : 'bg-blue-200 text-blue-800'}`}>
              {infoCount}
            </span>
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" />
            Phân loại:
          </span>
          {categoryOptions.map((cat) => {
            const Icon = cat.icon;
            const isSelected = categoryFilter === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(cat.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications Grid / List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-800">Không tìm thấy thông báo phù hợp</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
              Không có thông báo nào khớp với bộ lọc hiện tại. Thử xóa tìm kiếm hoặc chuyển sang bộ lọc khác.
            </p>
            {(searchQuery || severityFilter !== 'ALL' || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSeverityFilter('ALL');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const cat = inferCategory(item);
            const isDanger = item.level === 'DANGER';
            const isWarning = item.level === 'WARNING';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedNotification(item)}
                className={`group rounded-3xl p-4 sm:p-5 border transition-all duration-200 hover:shadow-md cursor-pointer relative flex flex-col sm:flex-row items-start gap-4 ${
                  !item.isRead
                    ? isDanger
                      ? 'bg-rose-50/30 border-rose-200/80 hover:border-rose-300'
                      : isWarning
                      ? 'bg-amber-50/30 border-amber-200/80 hover:border-amber-300'
                      : 'bg-blue-50/30 border-blue-200/80 hover:border-blue-300'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Unread indicator bar */}
                {!item.isRead && (
                  <span
                    className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${
                      isDanger ? 'bg-rose-600' : isWarning ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                  />
                )}

                {/* Icon Box */}
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                    isDanger
                      ? 'bg-rose-100 text-rose-700'
                      : isWarning
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {getCategoryIcon(cat, item.level)}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                  {/* Badges line */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {/* Severity Badge */}
                    <span
                      className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg border uppercase tracking-wider ${
                        isDanger
                          ? 'bg-rose-100 border-rose-300 text-rose-800'
                          : isWarning
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'bg-blue-100 border-blue-300 text-blue-800'
                      }`}
                    >
                      {item.level === 'DANGER' ? 'Khẩn cấp' : item.level === 'WARNING' ? 'Cảnh báo' : 'Thông tin'}
                    </span>

                    {/* Pond badge */}
                    {item.pondName && (
                      <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-cyan-600" />
                        {item.pondName}
                      </span>
                    )}

                    {/* Farm badge */}
                    {item.farmName && (
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg">
                        {item.farmName}
                      </span>
                    )}

                    {/* Relative Time */}
                    <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className={`text-base font-extrabold leading-snug ${!item.isRead ? 'text-slate-900' : 'text-slate-800'}`}>
                    {item.title}
                  </h3>

                  {/* Message Preview */}
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed line-clamp-2">
                    {item.message}
                  </p>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center mt-2 sm:mt-0">
                  {/* Context Navigate Button */}
                  {onNavigateTab && (item.pondId || item.farmId || cat === 'INCIDENT') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateFromItem(item);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      title="Chuyển đến màn hình xử lý"
                    >
                      <span>Xem & Xử lý</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Toggle Read */}
                  {!item.isRead ? (
                    <button
                      type="button"
                      onClick={(e) => handleMarkAsRead(item.id, e)}
                      title="Đánh dấu đã đọc"
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border border-transparent hover:border-blue-100"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-slate-300 p-2" title="Đã đọc">
                      <CheckCheck className="w-4 h-4" />
                    </span>
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNotification(item.id, e)}
                    title="Xóa thông báo"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal Preview */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                    selectedNotification.level === 'DANGER'
                      ? 'bg-rose-100 text-rose-700'
                      : selectedNotification.level === 'WARNING'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {getCategoryIcon(inferCategory(selectedNotification), selectedNotification.level)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                        selectedNotification.level === 'DANGER'
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : selectedNotification.level === 'WARNING'
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-blue-50 border-blue-200 text-blue-700'
                      }`}
                    >
                      {selectedNotification.level === 'DANGER'
                        ? 'Khẩn cấp'
                        : selectedNotification.level === 'WARNING'
                        ? 'Cảnh báo'
                        : 'Thông tin'}
                    </span>
                    {!selectedNotification.isRead && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-600 text-white">
                        Mới
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(selectedNotification.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-black text-slate-900 leading-snug">
                {selectedNotification.title}
              </h2>

              {(selectedNotification.pondName || selectedNotification.farmName) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedNotification.pondName && (
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-slate-200">
                      <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                      Ao nuôi: {selectedNotification.pondName}
                    </span>
                  )}
                  {selectedNotification.farmName && (
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-xl">
                      Trang trại: {selectedNotification.farmName}
                    </span>
                  )}
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedNotification.message}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDeleteNotification(selectedNotification.id)}
                className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa thông báo
              </button>

              <div className="flex items-center gap-2">
                {!selectedNotification.isRead && (
                  <button
                    type="button"
                    onClick={() => handleMarkAsRead(selectedNotification.id)}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}

                {onNavigateTab && (selectedNotification.pondId || selectedNotification.farmId) && (
                  <button
                    type="button"
                    onClick={() => handleNavigateFromItem(selectedNotification)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-600/20"
                  >
                    <span>Đến xử lý ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Xác nhận xóa tất cả</h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ lịch sử thông báo của bạn sẽ bị xóa vĩnh viễn khỏi hệ thống. Bạn có chắc chắn muốn tiếp tục?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                disabled={isClearing}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-rose-600/20"
              >
                {isClearing ? 'Đang xóa...' : 'Xóa tất cả'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
