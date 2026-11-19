import { useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import type { NotificationItem } from './NotificationsCenter';

interface EmergencyAlertBannerProps {
  notifications: NotificationItem[];
  onNavigateTab?: (tabName: string, config?: { farmId?: string; pondId?: string }) => void;
  onMarkAsRead?: (id: string) => void;
}

export default function EmergencyAlertBanner({
  notifications,
  onNavigateTab,
  onMarkAsRead,
}: EmergencyAlertBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('dismissed_emergency_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Find the highest priority unread DANGER or severe WARNING alert that is not dismissed
  const criticalAlert = notifications.find(
    (n) => !n.isRead && n.level === 'DANGER' && !dismissedIds.includes(n.id),
  );

  if (!criticalAlert) return null;

  const handleDismiss = () => {
    const next = [...dismissedIds, criticalAlert.id];
    setDismissedIds(next);
    try {
      sessionStorage.setItem('dismissed_emergency_alerts', JSON.stringify(next));
    } catch {
      // sessionStorage có thể bị chặn (chế độ riêng tư) – bỏ qua, banner vẫn ẩn trong phiên này
    }
  };

  const handleAction = () => {
    if (onMarkAsRead) {
      onMarkAsRead(criticalAlert.id);
    }
    if (onNavigateTab) {
      const lowerTitle = (criticalAlert.title || '').toLowerCase();
      const config = {
        farmId: criticalAlert.farmId,
        pondId: criticalAlert.pondId,
      };

      if (lowerTitle.includes('sự cố')) {
        onNavigateTab('Sự cố trang trại', config);
      } else if (lowerTitle.includes('tăng trưởng') || lowerTitle.includes('fcr')) {
        onNavigateTab('Theo dõi tăng trưởng', config);
      } else if (lowerTitle.includes('sức khỏe') || lowerTitle.includes('báo động đỏ')) {
        onNavigateTab('Sức khỏe tôm', config);
      } else if (lowerTitle.includes('môi trường') || criticalAlert.pondId) {
        onNavigateTab('Môi trường nước', config);
      } else {
        onNavigateTab('Quản lý Trang Trại', config);
      }
    }
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 p-4 text-white shadow-xl shadow-rose-600/20 border border-rose-400/40 animate-in slide-in-from-top-4 duration-300">
      {/* Background glowing effect */}
      <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-white text-rose-700 tracking-wider shadow-sm">
                🚨 Cảnh Báo Khẩn Cấp
              </span>
              {criticalAlert.pondName && (
                <span className="text-xs font-bold text-rose-100 bg-rose-800/40 px-2 py-0.5 rounded-md">
                  Ao: {criticalAlert.pondName}
                </span>
              )}
              {criticalAlert.farmName && (
                <span className="text-xs text-rose-200/90 font-medium">
                  Trang trại: {criticalAlert.farmName}
                </span>
              )}
            </div>
            <h4 className="text-sm font-extrabold mt-0.5 text-white">
              {criticalAlert.title}
            </h4>
            <p className="text-xs text-rose-100/90 line-clamp-1 mt-0.5">
              {criticalAlert.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            type="button"
            onClick={handleAction}
            className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-[1.02]"
          >
            <span>Xử lý ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            title="Đóng cảnh báo"
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
