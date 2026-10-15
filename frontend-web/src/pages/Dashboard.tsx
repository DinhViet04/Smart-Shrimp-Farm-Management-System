import { lazy, Suspense, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Waves, Droplets, Bot, LogOut, Settings, Building2, Package,
  TrendingUp, HeartPulse, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import NotificationDropdown from '../components/NotificationDropdown';
import ManagerDashboardHome from '../features/manager/ManagerDashboardHome';
import { type GrowthTabType } from '../features/growth/GrowthHeaderTabs';
import LoadingMotion from '../components/LoadingMotion';
import { logoutSession } from '../utils/api';

const AccountSettings = lazy(() => import('../components/AccountSettings'));
const FarmList = lazy(() => import('../features/farms/FarmList'));
const PondCropDashboard = lazy(() => import('../components/PondCropDashboard'));
const EnvironmentDashboard = lazy(() => import('../features/environment/EnvironmentDashboard'));
const InventoryManagement = lazy(() => import('../features/inventory/InventoryManagement'));
const ShrimpSizeDashboard = lazy(() => import('../features/shrimp-size/ShrimpSizeDashboard'));
const BiomassDashboard = lazy(() => import('../features/biomass/BiomassDashboard'));
const SurvivalRateDashboard = lazy(() => import('../features/survival-rate/SurvivalRateDashboard'));
const FcrDashboard = lazy(() => import('../features/fcr/FcrDashboard'));
const ShrimpHealthDashboard = lazy(() => import('../features/shrimp-health/ShrimpHealthDashboard'));

interface CurrentUser {
  id?: string;
  name?: string;
  fullName?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const [hoveredTooltip, setHoveredTooltip] = useState<{
    text: string;
    top: number;
    subtext?: string;
    isDanger?: boolean;
  } | null>(null);

  const [growthSubTab, setGrowthSubTab] = useState<GrowthTabType>('Theo dõi kích cỡ');
  const [currentUser] = useState<CurrentUser | null>(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr) as CurrentUser;
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
      }
    }
    return null;
  });
  const [pondCropConfig, setPondCropConfig] = useState<{
    initialSubTab?: 'ponds' | 'crops';
    initialFarmId?: string;
    initialPondId?: string;
    initialCropYear?: string;
    initialCropQuarter?: string;
    initialCropView?: 'active' | 'history';
    initialCropConfig?: { farmId?: string; pondId?: string };
  } | null>(null);

  const [growthConfig, setGrowthConfig] = useState<{
    farmId?: string;
    pondId?: string;
    cropId?: string;
  } | null>(() => {
    const savedPondId = localStorage.getItem('growth_active_pond_id');
    const savedFarmId = localStorage.getItem('growth_active_farm_id');
    if (savedPondId || savedFarmId) {
      return { pondId: savedPondId || undefined, farmId: savedFarmId || undefined };
    }
    return null;
  });

  const [envConfig, setEnvConfig] = useState<{
    farmId?: string;
    pondId?: string;
  } | null>(null);

  const [healthConfig, setHealthConfig] = useState<{
    farmId?: string;
    pondId?: string;
    subTab?: 'record' | 'history' | 'incident';
  } | null>(null);

  const handleNavigateToPonds = (farmId?: string) => {
    setPondCropConfig({
      initialSubTab: 'ponds',
      initialFarmId: farmId,
    });
    setActiveTab('Quản lý Ao/Vụ');
  };

  const handleNavigateToGrowth = (config: { farmId: string; pondId: string; cropId?: string }) => {
    setGrowthConfig(config);
    setGrowthSubTab('Theo dõi kích cỡ');
    setActiveTab('Theo dõi tăng trưởng');
  };

  const handleOpenCropHistory = (farmId?: string, pondId?: string, year?: number, quarter?: number | null) => {
    setPondCropConfig({
      initialSubTab: 'crops',
      initialCropView: 'history',
      initialFarmId: farmId,
      initialPondId: pondId,
      initialCropYear: year ? String(year) : undefined,
      initialCropQuarter: quarter ? String(quarter) : undefined,
    });
    setActiveTab('Quản lý Ao/Vụ');
  };


  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    switch(role) {
      case 'ADMIN': return 'Quản trị viên';
      case 'FARM_MANAGER': return 'Quản lý trang trại';
      case 'TECHNICIAN': return 'Kỹ thuật viên';
      case 'FARMER': return 'Nông dân';
      default: return 'Người dùng';
    }
  };

  const handleLogout = async () => {
    await logoutSession();
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Quản lý Trang Trại', icon: <Building2 className="w-5 h-5" /> },
    { name: 'Quản lý Ao/Vụ', icon: <Waves className="w-5 h-5" /> },
    { name: 'Theo dõi tăng trưởng', icon: <TrendingUp className="w-5 h-5" /> },
    { name: 'Quản Lý Kho', icon: <Package className="w-5 h-5" /> },
    { name: 'Môi trường nước', icon: <Droplets className="w-5 h-5" /> },
    { name: 'Sức khỏe tôm', icon: <HeartPulse className="w-5 h-5" /> },
    { name: 'Trợ lý AI', icon: <Bot className="w-5 h-5" /> },
    { name: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        onMouseLeave={() => setHoveredTooltip(null)}
        className={`relative flex flex-col z-30 flex-shrink-0 transition-all duration-500 ease-out ${
          isSidebarCollapsed
            ? 'w-20 my-3 ml-3 h-[calc(100vh-1.5rem)] rounded-3xl bg-white/85 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.08)]'
            : 'w-72 h-screen bg-white border-r border-slate-200/80 shadow-sm'
        }`}
      >

        {/* Header / Logo & Top Toggle */}
        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center py-3.5 px-2 gap-2 border-b border-slate-100/80 flex-shrink-0">
            <img
              src="/logonen.jpg"
              alt="SSFM Logo"
              className="w-10 h-10 rounded-full object-cover bg-white shadow-sm border border-slate-200 flex-shrink-0 transition-transform duration-300 hover:scale-105"
            />
            {/* Dedicated Expand Button right below Logo */}
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
              className="group relative flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50/80 hover:bg-blue-100 text-blue-600 hover:scale-105 active:scale-95 transition-all duration-200 border border-blue-100/80 shadow-2xs"
            >
              <PanelLeftOpen className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        ) : (
          <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src="/logonen.jpg"
                alt="SSFM Logo"
                className="w-10 h-10 rounded-full object-cover bg-white shadow-sm border border-slate-200 flex-shrink-0 transition-transform duration-300 hover:scale-105"
              />
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight whitespace-nowrap">
                SSFM
              </span>
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              title="Thu gọn thanh điều hướng"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-1">
              Trang Trại của bạn
            </p>
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
                    className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25 scale-105 ring-2 ring-blue-400/20'
                        : 'text-slate-500 hover:text-blue-600 hover:bg-white hover:shadow-sm hover:scale-105'
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
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm border border-blue-100/50'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className={isActive ? 'text-blue-600' : 'text-slate-400'}>
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
          <div className="py-2.5 px-2 border-t border-slate-100/80 flex flex-col items-center gap-2 flex-shrink-0">
            {/* User Avatar with Tooltip */}
            <div
              className="group relative cursor-pointer"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTooltip({
                  text: currentUser?.fullName || 'Nông Dân',
                  subtext: currentUser?.role ? getRoleLabel(currentUser.role) : 'Thành viên',
                  top: rect.top + rect.height / 2,
                });
              }}
              onMouseLeave={() => setHoveredTooltip(null)}
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt="Avatar"
                  className="w-9 h-9 rounded-full object-cover shadow-sm border border-white ring-2 ring-slate-100 group-hover:ring-blue-400 transition-all"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shadow-sm border border-white ring-2 ring-slate-100 group-hover:ring-blue-400 transition-all">
                  {currentUser?.fullName ? getInitials(currentUser.fullName) : 'ND'}
                </div>
              )}
            </div>

            {/* Logout Button with Tooltip */}
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
              className="group relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
            >
              <LogOut className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        ) : (
          <div className="p-6 border-t border-slate-100 flex-shrink-0 bg-white">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center gap-3 mb-4">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {currentUser?.fullName ? getInitials(currentUser.fullName) : 'ND'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate" title={currentUser?.fullName || 'Nông Dân'}>
                  {currentUser?.fullName || 'Nông Dân'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {currentUser?.role ? getRoleLabel(currentUser.role) : 'Thành viên'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
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
            {/* Arrow */}
            <span
              className={`absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent ${
                hoveredTooltip.isDanger ? 'border-r-rose-600' : 'border-r-slate-900/95'
              }`}
            />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-30 sticky top-0">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{activeTab}</h1>
          
          <div className="flex items-center gap-6">
            <NotificationDropdown 
              themeColor="blue" 
              onNavigateTab={(tab, config) => {
                if (tab === 'Môi trường nước') {
                  if (config) setEnvConfig(config);
                  setActiveTab('Môi trường nước');
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

        <div className="flex-1 p-8 overflow-y-auto bg-slate-50 relative">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>

          {activeTab === 'Dashboard' && (
            <ManagerDashboardHome 
              onNavigateTab={(tab) => {
                if (tab === 'Sự cố & Điều trị') {
                  setHealthConfig(prev => ({ ...prev, subTab: 'incident' }));
                  setActiveTab('Sức khỏe tôm');
                } else {
                  setActiveTab(tab);
                }
              }} 
              onOpenCropHistory={handleOpenCropHistory}
            />
          )}

          <Suspense fallback={
            <div className="py-8">
              <LoadingMotion
                mode="card"
                title="Đang tải giao diện chức năng..."
                subtitle="Hệ thống đang chuẩn bị các mô-đun và đồng bộ dữ liệu..."
                color="blue"
              />
            </div>
          }>
          {activeTab === 'Cài đặt' ? (
            <AccountSettings />
          ) : activeTab === 'Quản lý Trang Trại' ? (
            <FarmList onNavigateToPonds={handleNavigateToPonds} />
          ) : activeTab === 'Quản lý Ao/Vụ' ? (
            <PondCropDashboard 
              initialSubTab={pondCropConfig?.initialSubTab}
              initialFarmId={pondCropConfig?.initialFarmId}
              initialPondId={pondCropConfig?.initialPondId}
              initialCropView={pondCropConfig?.initialCropView}
              initialCropYear={pondCropConfig?.initialCropYear}
              initialCropQuarter={pondCropConfig?.initialCropQuarter}
              initialCropConfig={pondCropConfig?.initialCropConfig}
              onNavigateToGrowth={handleNavigateToGrowth}
            />
          ) : activeTab === 'Theo dõi tăng trưởng' ? (
            <div className="w-full h-full flex flex-col justify-start overflow-y-auto">
              {growthSubTab === 'Theo dõi kích cỡ' ? (
                <ShrimpSizeDashboard 
                  viewOnly={currentUser?.role !== 'TECHNICIAN'} 
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
                  viewOnly={currentUser?.role !== 'ADMIN' && currentUser?.role !== 'FARM_MANAGER'} 
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
          ) : activeTab === 'Quản Lý Kho' ? (
            <InventoryManagement />
          ) : activeTab === 'Môi trường nước' ? (
            <EnvironmentDashboard 
              viewOnly={currentUser?.role !== 'ADMIN' && currentUser?.role !== 'TECHNICIAN'} 
              initialFarmId={envConfig?.farmId}
              initialPondId={envConfig?.pondId}
            />
          ) : activeTab === 'Sức khỏe tôm' || activeTab === 'Sự cố & Điều trị' ? (
            <ShrimpHealthDashboard 
              viewOnly={currentUser?.role !== 'ADMIN' && currentUser?.role !== 'TECHNICIAN'} 
              initialFarmId={healthConfig?.farmId}
              initialPondId={healthConfig?.pondId}
              initialSubTab={activeTab === 'Sự cố & Điều trị' ? 'incident' : healthConfig?.subTab}
              role="FARM_MANAGER"
            />
          ) : activeTab !== 'Dashboard' ? (
            <div className="h-full flex items-center justify-center relative z-10">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
                  <Waves className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Đang phát triển</h2>
                <p className="text-slate-500 max-w-md mx-auto">Tính năng <span className="font-semibold text-blue-600">{activeTab}</span> đang trong quá trình hoàn thiện và sẽ sớm ra mắt.</p>
              </div>
            </div>
          ) : null}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
