import { lazy, Suspense, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Waves, 
  Droplets, 
  ClipboardList, 
  Settings, 
  LogOut, 
  Search, 
  Leaf,
  Package,
  HeartPulse,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

import NotificationDropdown from '../components/NotificationDropdown';
import FarmerDashboardHome from '../features/farmer/FarmerDashboardHome';
import { logoutSession } from '../utils/api';
import { type GrowthTabType } from '../features/growth/GrowthHeaderTabs';
import LoadingMotion from '../components/LoadingMotion';

const AccountSettings = lazy(() => import('../components/AccountSettings'));
const InventoryManagement = lazy(() => import('../features/inventory/InventoryManagement'));
const EnvironmentDashboard = lazy(() => import('../features/environment/EnvironmentDashboard'));
const ShrimpHealthDashboard = lazy(() => import('../features/shrimp-health/ShrimpHealthDashboard'));
const PondCropDashboard = lazy(() => import('../components/PondCropDashboard'));
const FeedingLogDashboard = lazy(() => import('../features/feeding-logs/FeedingLogDashboard'));
const IncidentDashboard = lazy(() => import('../features/incidents/IncidentDashboard'));
const ShrimpSizeDashboard = lazy(() => import('../features/shrimp-size/ShrimpSizeDashboard'));
const BiomassDashboard = lazy(() => import('../features/biomass/BiomassDashboard'));
const SurvivalRateDashboard = lazy(() => import('../features/survival-rate/SurvivalRateDashboard'));
const FcrDashboard = lazy(() => import('../features/fcr/FcrDashboard'));

export default function FarmerDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [growthSubTab, setGrowthSubTab] = useState<GrowthTabType>('Theo dõi kích cỡ');
  const [growthConfig, setGrowthConfig] = useState<{ farmId?: string; pondId?: string; cropId?: string } | null>(null);
  const [envConfig, setEnvConfig] = useState<{ farmId?: string; pondId?: string } | null>(null);
  const [healthConfig, setHealthConfig] = useState<{ farmId?: string; pondId?: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const handleNavigateToGrowth = (config: { farmId: string; pondId: string; cropId?: string }) => {
    setGrowthConfig(config);
    setGrowthSubTab('Theo dõi kích cỡ');
    setActiveTab('Theo dõi tăng trưởng');
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
  }, []);

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
    { name: 'Quản lý Ao của tôi', icon: <Waves className="w-5 h-5" /> },
    { name: 'Môi trường nước', icon: <Droplets className="w-5 h-5" /> },
    { name: 'Sức khỏe tôm', icon: <HeartPulse className="w-5 h-5" /> },
    { name: 'Theo dõi tăng trưởng', icon: <TrendingUp className="w-5 h-5 text-teal-600" /> },
    { name: 'Báo cáo sự cố', icon: <AlertTriangle className="w-5 h-5" /> },
    { name: 'Nhật ký Chăm sóc', icon: <ClipboardList className="w-5 h-5" /> },
    { name: 'Kho thức ăn', icon: <Package className="w-5 h-5" /> },
    { name: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-stone-50 font-sans overflow-hidden">
      {/* Sidebar - Earthy / Nature Theme */}
      <aside className="w-72 bg-white border-r border-teal-100 flex flex-col shadow-sm z-10 h-screen max-h-screen">
        <div className="h-20 flex items-center px-8 border-b border-teal-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center shadow-md">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-teal-800 tracking-tight">Farmer App</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 custom-scrollbar">
          <p className="text-xs font-bold text-teal-600/70 uppercase tracking-wider mb-4">Công việc hàng ngày</p>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                  activeTab === item.name 
                    ? 'bg-teal-50 text-teal-700 font-bold shadow-sm border border-teal-200/60 translate-x-1' 
                    : 'text-stone-600 hover:bg-stone-100 hover:text-teal-700 font-medium'
                }`}
              >
                <div className={`${activeTab === item.name ? 'text-teal-600' : 'text-stone-400'}`}>
                  {item.icon}
                </div>
                {item.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 border-t border-teal-50 flex-shrink-0 bg-white">
          <div className="bg-teal-50/50 rounded-2xl p-4 border border-teal-100 flex items-center gap-3 mb-4">
            {currentUser?.avatarUrl ? (
              <img 
                src={currentUser.avatarUrl} 
                alt="Avatar" 
                className="w-10 h-10 rounded-full object-cover shadow-sm border border-teal-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                {currentUser?.fullName ? getInitials(currentUser.fullName) : 'ND'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-teal-900 truncate" title={currentUser?.fullName || 'Nông Dân'}>
                {currentUser?.fullName || 'Nông Dân'}
              </p>
              <p className="text-xs font-semibold text-teal-600/80 truncate">
                Nông dân
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-teal-100 flex items-center justify-between px-8 z-30 sticky top-0">
          <h1 className="text-2xl font-extrabold text-teal-900 tracking-tight">{activeTab}</h1>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input 
                type="text" 
                placeholder="Tìm kiếm..." 
                className="pl-10 pr-4 py-2 bg-stone-100 border-transparent rounded-full text-sm focus:bg-white focus:border-teal-300 focus:ring-2 focus:ring-teal-200 outline-none transition-all w-64 text-stone-700 placeholder-stone-400 font-medium"
              />
            </div>
            <NotificationDropdown 
              themeColor="teal" 
              onNavigateTab={(tab, config) => {
                if (tab === 'Môi trường nước') {
                  if (config) setEnvConfig(config);
                  setActiveTab('Môi trường nước');
                } else if (tab === 'Sức khỏe tôm') {
                  if (config) setHealthConfig(config);
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

        <div className="flex-1 p-8 overflow-y-auto relative z-0">
          {/* Subtle Background Elements */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-400/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-400/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>

          {activeTab === 'Dashboard' && (
            <FarmerDashboardHome onNavigateTab={setActiveTab} currentUser={currentUser} />
          )}

          <Suspense fallback={
            <div className="py-8">
              <LoadingMotion
                mode="card"
                title="Đang tải giao diện chức năng..."
                subtitle="Hệ thống đang chuẩn bị các mô-đun và đồng bộ dữ liệu..."
                color="teal"
              />
            </div>
          }>
          {activeTab === 'Cài đặt' ? (
             <AccountSettings />
          ) : activeTab === 'Kho thức ăn' ? (
             <InventoryManagement />
          ) : activeTab === 'Môi trường nước' ? (
             <EnvironmentDashboard 
               viewOnly={true} 
               initialFarmId={envConfig?.farmId}
               initialPondId={envConfig?.pondId}
             />
          ) : activeTab === 'Quản lý Ao của tôi' ? (
             <PondCropDashboard onNavigateToGrowth={handleNavigateToGrowth} />
          ) : activeTab === 'Sức khỏe tôm' ? (
             <ShrimpHealthDashboard 
               viewOnly={true} 
               initialFarmId={healthConfig?.farmId}
               initialPondId={healthConfig?.pondId}
             />
          ) : activeTab === 'Theo dõi tăng trưởng' ? (
             <div className="w-full h-full flex flex-col justify-start overflow-y-auto">
               {growthSubTab === 'Theo dõi kích cỡ' ? (
                 <ShrimpSizeDashboard 
                   viewOnly={true} 
                   onNavigateTab={(tab) => setGrowthSubTab(tab)}
                   initialFarmId={growthConfig?.farmId}
                   initialPondId={growthConfig?.pondId}
                   onSelectFarm={(farmId) => setGrowthConfig(prev => ({ ...prev, farmId }))}
                   onSelectPond={(pondId) => setGrowthConfig(prev => ({ ...prev, pondId }))}
                 />
               ) : growthSubTab === 'Sinh khối ao' ? (
                 <BiomassDashboard 
                   viewOnly={true}
                   onNavigateTab={(tab) => setGrowthSubTab(tab)}
                   initialFarmId={growthConfig?.farmId}
                   initialPondId={growthConfig?.pondId}
                   onSelectFarm={(farmId) => setGrowthConfig(prev => ({ ...prev, farmId }))}
                   onSelectPond={(pondId) => setGrowthConfig(prev => ({ ...prev, pondId }))}
                 />
               ) : growthSubTab === 'Theo dõi tỷ lệ sống' ? (
                 <SurvivalRateDashboard 
                   viewOnly={true} 
                   onNavigateTab={(tab) => setGrowthSubTab(tab)}
                   initialFarmId={growthConfig?.farmId}
                   initialPondId={growthConfig?.pondId}
                   initialCropId={growthConfig?.cropId}
                   onSelectFarm={(farmId) => setGrowthConfig(prev => ({ ...prev, farmId }))}
                   onSelectPond={(pondId) => setGrowthConfig(prev => ({ ...prev, pondId }))}
                   onSelectCrop={(cropId) => setGrowthConfig(prev => ({ ...prev, cropId }))}
                 />
               ) : (
                 <FcrDashboard 
                   onNavigateTab={(tab) => setGrowthSubTab(tab)}
                   initialFarmId={growthConfig?.farmId}
                   initialPondId={growthConfig?.pondId}
                   onSelectFarm={(farmId) => setGrowthConfig(prev => ({ ...prev, farmId }))}
                   onSelectPond={(pondId) => setGrowthConfig(prev => ({ ...prev, pondId }))}
                 />
               )}
             </div>
          ) : activeTab === 'Báo cáo sự cố' ? (
             <IncidentDashboard role="FARMER" />
          ) : activeTab === 'Nhật ký Chăm sóc' ? (
             <FeedingLogDashboard />
          ) : activeTab !== 'Dashboard' ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-12 bg-white border border-teal-100 rounded-3xl shadow-sm max-w-lg">
                <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  {activeTab === 'Quản lý Ao của tôi' && <Waves className="w-12 h-12 text-teal-500" />}
                  {activeTab === 'Nhật ký Chăm sóc' && <ClipboardList className="w-12 h-12 text-teal-500" />}
                </div>
                <h2 className="text-2xl font-black text-teal-900 mb-3">{activeTab}</h2>
                <p className="text-stone-500 text-lg">
                  Tính năng này dành riêng cho Nông dân đang được xây dựng (Frontend mock). 
                  Giao diện và API sẽ được cập nhật trong giai đoạn sau.
                </p>
                <button onClick={() => setActiveTab('Dashboard')} className="mt-8 px-6 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20">
                  Quay lại Tổng quan
                </button>
              </div>
            </div>
          ) : null}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
