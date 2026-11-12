import { lazy, Suspense, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Search, 
  Wrench,
  Droplets,
  HeartPulse,
  TrendingUp,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';

import NotificationDropdown from '../components/NotificationDropdown';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import TechnicianOverviewDashboard from '../features/growth/TechnicianOverviewDashboard';
import { type GrowthTabType } from '../features/growth/GrowthHeaderTabs';
import LoadingMotion from '../components/LoadingMotion';
import { logoutSession } from '../utils/api';

const AccountSettings = lazy(() => import('../components/AccountSettings'));
const EnvironmentDashboard = lazy(() => import('../features/environment/EnvironmentDashboard'));
const FarmIncidentDashboard = lazy(() => import('../features/incidents/FarmIncidentDashboard'));
const ShrimpHealthDashboard = lazy(() => import('../features/shrimp-health/ShrimpHealthDashboard'));
const ShrimpSizeDashboard = lazy(() => import('../features/shrimp-size/ShrimpSizeDashboard'));
const BiomassDashboard = lazy(() => import('../features/biomass/BiomassDashboard'));
const SurvivalRateDashboard = lazy(() => import('../features/survival-rate/SurvivalRateDashboard'));
const FcrDashboard = lazy(() => import('../features/fcr/FcrDashboard'));
const InventoryManagement = lazy(() => import('../features/inventory/InventoryManagement'));
const FarmChatGroupView = lazy(() => import('../features/chat-groups/FarmChatGroupView'));

interface CurrentUser {
  id?: string;
  name?: string;
  fullName?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [growthSubTab, setGrowthSubTab] = useState<GrowthTabType>('Theo dõi kích cỡ');
  const [growthConfig, setGrowthConfig] = useState<{ farmId?: string; pondId?: string; cropId?: string } | null>(() => {
    const savedPondId = localStorage.getItem('growth_active_pond_id');
    const savedFarmId = localStorage.getItem('growth_active_farm_id');
    if (savedPondId || savedFarmId) {
      return { pondId: savedPondId || undefined, farmId: savedFarmId || undefined };
    }
    return null;
  });
  const [envConfig, setEnvConfig] = useState<{ farmId?: string; pondId?: string } | null>(null);
  const [healthConfig, setHealthConfig] = useState<{ farmId?: string; pondId?: string; subTab?: 'record' | 'history' | 'incident' } | null>(null);
  const [currentUser] = useState<CurrentUser | null>(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr) as CurrentUser;
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
    return null;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed_technician') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed_technician', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const [hoveredTooltip, setHoveredTooltip] = useState<{
    text: string;
    top: number;
    subtext?: string;
    isDanger?: boolean;
  } | null>(null);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    await logoutSession();
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Môi trường nước', icon: <Droplets className="w-5 h-5" /> },
    { name: 'Sức khỏe tôm', icon: <HeartPulse className="w-5 h-5" /> },
    { name: 'Theo dõi tăng trưởng', icon: <TrendingUp className="w-5 h-5" /> },
    { name: 'Kho thức ăn', icon: <Package className="w-5 h-5" /> },
    { name: 'Báo cáo sự cố', icon: <AlertTriangle className="w-5 h-5 text-amber-500" /> },
    { name: 'Nhóm Chat', icon: <MessageSquare className="w-5 h-5" /> },
    { name: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar - Technician Theme (Indigo) */}
      <aside
        onMouseLeave={() => setHoveredTooltip(null)}
        className={`relative flex flex-col z-30 flex-shrink-0 transition-all duration-500 ease-out ${
          isSidebarCollapsed
            ? 'w-20 my-3 ml-3 h-[calc(100vh-1.5rem)] rounded-3xl bg-white/85 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.08)]'
            : 'w-72 h-screen bg-white border-r border-indigo-100 shadow-sm'
        }`}
      >
        {/* Header / Logo & Top Toggle */}
        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center py-3.5 px-2 gap-2 border-b border-indigo-50/80 flex-shrink-0">
            <img
              src="/logonen.jpg"
              alt="SSFM Logo"
              className="w-10 h-10 rounded-full object-cover bg-white shadow-sm border border-slate-200 flex-shrink-0 transition-transform duration-300 hover:scale-105"
            />
            {/* Dedicated Expand Button */}
            <button
              onClick={() => {
                setIsSidebarCollapsed(false);
                setHoveredTooltip(null);
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTooltip({
                  text: 'Mở rộng thanh điều hướng',
                  top: rect.top + rect.height / 2,
                });
              }}
              onMouseLeave={() => setHoveredTooltip(null)}
              title="Mở rộng thanh điều hướng"
              className="group relative flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 text-indigo-600 hover:scale-105 active:scale-95 transition-all duration-200 border border-indigo-100/80 shadow-2xs cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        ) : (
          <div className="h-20 flex items-center justify-between px-6 border-b border-indigo-50 flex-shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src="/logonen.jpg"
                alt="SSFM Logo"
                className="w-10 h-10 rounded-full object-cover bg-white shadow-sm border border-slate-200 flex-shrink-0 transition-transform duration-300 hover:scale-105"
              />
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-900 tracking-tight whitespace-nowrap">
                SSFM
              </span>
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              title="Thu gọn thanh điều hướng"
              className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Navigation List */}
        <div className={`flex-1 min-h-0 ${
          isSidebarCollapsed
            ? 'py-2.5 px-2 flex flex-col items-center overflow-visible'
            : 'px-6 py-4 overflow-y-auto custom-scrollbar'
        }`}>
          {!isSidebarCollapsed && (
            <p className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider mb-4 px-1">Điều hướng</p>
          )}
          <nav className={isSidebarCollapsed ? 'space-y-1.5 flex flex-col items-center w-full' : 'space-y-1.5 w-full'}>
            {navItems.map((item) => {
              const isActive = activeTab === item.name;

              if (isSidebarCollapsed) {
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setActiveTab(item.name)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredTooltip({
                        text: item.name,
                        top: rect.top + rect.height / 2,
                      });
                    }}
                    onMouseLeave={() => setHoveredTooltip(null)}
                    title={item.name}
                    className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-tr from-indigo-600 to-sky-500 text-white shadow-lg shadow-indigo-500/25 scale-105 ring-2 ring-indigo-400/20'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-white hover:shadow-xs hover:scale-105'
                    }`}
                  >
                    <div className="transition-transform duration-200 group-hover:scale-110">
                      {item.icon}
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setActiveTab(item.name)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-700 font-bold shadow-xs border border-indigo-200/60 translate-x-1' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700 font-medium'
                  }`}
                >
                  <div className={`${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {item.icon}
                  </div>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer / User Profile */}
        {isSidebarCollapsed ? (
          <div className="py-2.5 px-2 border-t border-indigo-50/80 flex flex-col items-center gap-2 flex-shrink-0">
            <div
              className="group relative cursor-pointer"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTooltip({
                  text: currentUser?.fullName || 'Kỹ thuật viên',
                  subtext: 'Technician',
                  top: rect.top + rect.height / 2,
                });
              }}
              onMouseLeave={() => setHoveredTooltip(null)}
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt="Avatar"
                  className="w-9 h-9 rounded-full object-cover shadow-sm border border-white ring-2 ring-indigo-100 group-hover:ring-indigo-400 transition-all"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shadow-sm border border-white ring-2 ring-indigo-100 group-hover:ring-indigo-400 transition-all">
                  {currentUser?.fullName ? getInitials(currentUser.fullName) : 'KT'}
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTooltip({
                  text: 'Đăng xuất',
                  top: rect.top + rect.height / 2,
                  isDanger: true,
                });
              }}
              onMouseLeave={() => setHoveredTooltip(null)}
              title="Đăng xuất"
              className="group relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer"
            >
              <LogOut className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        ) : (
          <div className="p-6 border-t border-indigo-50 flex-shrink-0 bg-white">
            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 flex items-center gap-3 mb-4">
              {currentUser?.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full object-cover shadow-sm border border-indigo-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  {currentUser?.fullName ? getInitials(currentUser.fullName) : 'KT'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-indigo-900 truncate" title={currentUser?.fullName || 'Kỹ thuật viên'}>
                  {currentUser?.fullName || 'Kỹ thuật viên'}
                </p>
                <p className="text-xs font-semibold text-indigo-600/80 truncate">
                  Technician
                </p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Đăng xuất
            </button>
          </div>
        )}

        {/* Floating Tooltip Anchor for Collapsed Mode */}
        {isSidebarCollapsed && hoveredTooltip && (
          <div
            style={{ top: `${hoveredTooltip.top}px` }}
            className={`fixed left-[98px] -translate-y-1/2 px-3.5 py-2 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.25)] text-white z-[9999] pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95 flex items-center whitespace-nowrap ${
              hoveredTooltip.isDanger
                ? 'bg-rose-600 border border-rose-500/50'
                : 'bg-slate-900/95 backdrop-blur-md border border-slate-700/60'
            }`}
          >
            <div className="flex flex-col">
              <span className="font-semibold text-[13px] tracking-wide text-white leading-tight">
                {hoveredTooltip.text}
              </span>
              {hoveredTooltip.subtext && (
                <span className="text-[11px] text-slate-300 font-normal mt-0.5">
                  {hoveredTooltip.subtext}
                </span>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-indigo-100 flex items-center justify-between px-8 z-30 sticky top-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-indigo-900 tracking-tight">{activeTab}</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm kiếm..." 
                className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 outline-none transition-all w-64 text-slate-700 placeholder-slate-400 font-medium"
              />
            </div>
            <WorkspaceSwitcher />
            <NotificationDropdown 
              themeColor="indigo" 
              onNavigateTab={(tab, config) => {
                if (tab === 'Môi trường nước') {
                  if (config) setEnvConfig(config);
                  setActiveTab('Môi trường nước');
                } else if (tab === 'Báo cáo sự cố' || tab === 'Sự cố trang trại' || tab === 'Sự cố') {
                  setActiveTab('Báo cáo sự cố');
                } else if (tab === 'Sức khỏe tôm' || tab === 'Sự cố & Điều trị') {
                  setHealthConfig({
                    farmId: config?.farmId,
                    pondId: config?.pondId,
                    subTab: tab === 'Sự cố & Điều trị' ? 'incident' : undefined,
                  });
                  setActiveTab('Sức khỏe tôm');
                } else if (tab === 'Theo dõi tăng trưởng') {
                  if (config) {
                    setGrowthConfig({ farmId: config.farmId, pondId: config.pondId });
                    setGrowthSubTab('Theo dõi kích cỡ');
                  }
                  setActiveTab('Theo dõi tăng trưởng');
                } else {
                  setActiveTab(tab);
                }
              }} 
            />
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto relative">
          {/* Subtle Background Elements */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-400/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-400/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>

          <Suspense fallback={
            <div className="py-8 w-full max-w-4xl mx-auto">
              <LoadingMotion
                mode="card"
                title="Đang tải giao diện chức năng..."
                subtitle="Hệ thống đang chuẩn bị các mô-đun và đồng bộ dữ liệu..."
                color="indigo"
              />
            </div>
          }>
          {activeTab === 'Cài đặt' ? (
            <div className="w-full max-w-7xl mx-auto">
              <AccountSettings />
            </div>
          ) : activeTab === 'Môi trường nước' ? (
            <EnvironmentDashboard 
              initialFarmId={envConfig?.farmId}
              initialPondId={envConfig?.pondId}
            />
          ) : activeTab === 'Dashboard' ? (
            <div className="w-full max-w-[1400px] mx-auto">
              <TechnicianOverviewDashboard 
                initialFarmId={growthConfig?.farmId}
                initialPondId={growthConfig?.pondId}
                initialCropId={growthConfig?.cropId}
              />
            </div>
          ) : activeTab === 'Báo cáo sự cố' ? (
            <div className="w-full max-w-7xl mx-auto">
              <FarmIncidentDashboard role="TECHNICIAN" />
            </div>
          ) : activeTab === 'Sức khỏe tôm' || activeTab === 'Sự cố & Điều trị' ? (
            <ShrimpHealthDashboard 
              initialFarmId={healthConfig?.farmId}
              initialPondId={healthConfig?.pondId}
              initialSubTab={activeTab === 'Sự cố & Điều trị' ? 'incident' : healthConfig?.subTab}
              role="TECHNICIAN"
            />
          ) : activeTab === 'Theo dõi tăng trưởng' ? (
            <div className="w-full h-full flex flex-col justify-start">
              {growthSubTab === 'Theo dõi kích cỡ' ? (
                <ShrimpSizeDashboard 
                  viewOnly={false} 
                  onNavigateTab={(tab) => setGrowthSubTab(tab)} 
                  initialFarmId={growthConfig?.farmId}
                  initialPondId={growthConfig?.pondId}
                  onSelectFarm={(farmId) => {
                    if (farmId) localStorage.setItem('growth_active_farm_id', farmId);
                    setGrowthConfig(prev => ({ ...prev, farmId }));
                  }}
                  onSelectPond={(pondId) => {
                    if (pondId) localStorage.setItem('growth_active_pond_id', pondId);
                    setGrowthConfig(prev => ({ ...prev, pondId }));
                  }}
                />
              ) : growthSubTab === 'Sinh khối ao' ? (
                <BiomassDashboard 
                  onNavigateTab={(tab) => setGrowthSubTab(tab)} 
                  initialFarmId={growthConfig?.farmId}
                  initialPondId={growthConfig?.pondId}
                  onSelectFarm={(farmId) => {
                    if (farmId) localStorage.setItem('growth_active_farm_id', farmId);
                    setGrowthConfig(prev => ({ ...prev, farmId }));
                  }}
                  onSelectPond={(pondId) => {
                    if (pondId) localStorage.setItem('growth_active_pond_id', pondId);
                    setGrowthConfig(prev => ({ ...prev, pondId }));
                  }}
                />
              ) : growthSubTab === 'Theo dõi tỷ lệ sống' ? (
                <SurvivalRateDashboard 
                  viewOnly={true} 
                  onNavigateTab={(tab) => setGrowthSubTab(tab)} 
                  initialFarmId={growthConfig?.farmId}
                  initialPondId={growthConfig?.pondId}
                  initialCropId={growthConfig?.cropId}
                  onSelectFarm={(farmId) => {
                    if (farmId) localStorage.setItem('growth_active_farm_id', farmId);
                    setGrowthConfig(prev => ({ ...prev, farmId }));
                  }}
                  onSelectPond={(pondId) => {
                    if (pondId) localStorage.setItem('growth_active_pond_id', pondId);
                    setGrowthConfig(prev => ({ ...prev, pondId }));
                  }}
                  onSelectCrop={(cropId) => setGrowthConfig(prev => ({ ...prev, cropId }))}
                />
              ) : (
                <FcrDashboard 
                  onNavigateTab={(tab) => setGrowthSubTab(tab)} 
                  initialFarmId={growthConfig?.farmId}
                  initialPondId={growthConfig?.pondId}
                  onSelectFarm={(farmId) => {
                    if (farmId) localStorage.setItem('growth_active_farm_id', farmId);
                    setGrowthConfig(prev => ({ ...prev, farmId }));
                  }}
                  onSelectPond={(pondId) => {
                    if (pondId) localStorage.setItem('growth_active_pond_id', pondId);
                    setGrowthConfig(prev => ({ ...prev, pondId }));
                  }}
                />
              )}
            </div>
          ) : activeTab === 'Kho thức ăn' ? (
            <InventoryManagement />
          ) : activeTab === 'Nhóm Chat' ? (
            <div className="w-full max-w-7xl mx-auto">
              <FarmChatGroupView />
            </div>
          ) : (
            <div className="min-h-[450px] flex items-center justify-center">
              <div className="text-center p-12 bg-white border border-indigo-100 rounded-3xl shadow-sm max-w-xl">
                <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Wrench className="w-12 h-12 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-black text-indigo-900 mb-3">Khu Vực Kỹ Thuật Viên</h2>
                <p className="text-slate-500 text-lg">
                  Giao diện và các tính năng chi tiết dành cho chuyên gia kỹ thuật sẽ được phát triển và tích hợp trong các bản cập nhật sắp tới.
                </p>
              </div>
            </div>
          )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
