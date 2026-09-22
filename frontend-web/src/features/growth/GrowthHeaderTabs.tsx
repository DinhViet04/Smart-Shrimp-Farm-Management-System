import React from 'react';
import { Scale, PieChart, Activity, ShieldCheck, Wrench, User } from 'lucide-react';

export type GrowthTabType = 'Theo dõi kích cỡ' | 'Sinh khối ao' | 'Theo dõi tỷ lệ sống';

interface GrowthHeaderTabsProps {
  activeTab: GrowthTabType;
  onTabChange?: (tab: GrowthTabType) => void;
  title?: string;
  subtitle?: string;
  role?: string;
}

export default function GrowthHeaderTabs({
  activeTab,
  onTabChange,
  title = 'Trung Tâm Theo Dõi Tăng Trưởng',
  subtitle = 'Kiểm soát kích cỡ, sinh khối và tỷ lệ sống theo quy trình 5T',
  role,
}: GrowthHeaderTabsProps) {
  // Lấy role từ prop hoặc localStorage nếu chưa có
  const currentRole = role || (() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u).role : 'FARMER';
    } catch {
      return 'FARMER';
    }
  })();

  const getRoleBadge = () => {
    switch (currentRole) {
      case 'ADMIN':
      case 'FARM_MANAGER':
        return {
          label: 'Quản lý / Chủ trại',
          desc: 'Toàn quyền cấu hình, phê duyệt & đối soát',
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
          color: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
        };
      case 'TECHNICIAN':
        return {
          label: 'Kỹ thuật viên',
          desc: 'Nhập mẫu 5 mẻ chài, phân tích ADG & sinh khối',
          icon: <Wrench className="w-3.5 h-3.5" />,
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
        };
      default:
        return {
          label: 'Nông dân',
          desc: 'Theo dõi trực quan & hỗ trợ thao tác chài mẫu',
          icon: <User className="w-3.5 h-3.5" />,
          color: 'bg-teal-50 text-teal-700 border-teal-200/60',
        };
    }
  };

  const roleInfo = getRoleBadge();

  const tabs: { id: GrowthTabType; label: string; icon: React.ReactNode; shortDesc: string }[] = [
    {
      id: 'Theo dõi kích cỡ',
      label: 'Kích cỡ & Trọng lượng',
      icon: <Scale className="w-4 h-4" />,
      shortDesc: 'ABW, ADG & Chuẩn 5T',
    },
    {
      id: 'Sinh khối ao',
      label: 'Sinh khối & Mật độ',
      icon: <PieChart className="w-4 h-4" />,
      shortDesc: 'Biomass (kg) & Mẻ chài',
    },
    {
      id: 'Theo dõi tỷ lệ sống',
      label: 'Tỷ lệ sống & Hao hụt',
      icon: <Activity className="w-4 h-4" />,
      shortDesc: 'Survival rate & Tôm chết',
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 md:p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              {title}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${roleInfo.color}`}
              title={roleInfo.desc}
            >
              {roleInfo.icon}
              <span>{roleInfo.label}</span>
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange && onTabChange(tab.id)}
              className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50/80 border-blue-500/40 text-blue-900 shadow-xs ring-2 ring-blue-500/10'
                  : 'bg-slate-50/60 border-slate-200/70 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-500 border border-slate-200/60'
                }`}
              >
                {tab.icon}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold truncate ${isActive ? 'text-blue-950' : 'text-slate-800'}`}>
                  {tab.label}
                </p>
                <p className={`text-xs truncate ${isActive ? 'text-blue-600 font-medium' : 'text-slate-400'}`}>
                  {tab.shortDesc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
