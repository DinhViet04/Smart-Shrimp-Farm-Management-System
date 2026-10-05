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
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

import NotificationDropdown from '../components/NotificationDropdown';
import TechnicianOverviewDashboard from '../features/growth/TechnicianOverviewDashboard';
import { type GrowthTabType } from '../features/growth/GrowthHeaderTabs';

const AccountSettings = lazy(() => import('../components/AccountSettings'));
const EnvironmentDashboard = lazy(() => import('../features/environment/EnvironmentDashboard'));
const ShrimpHealthDashboard = lazy(() => import('../features/shrimp-health/ShrimpHealthDashboard'));
const IncidentDashboard = lazy(() => import('../features/incidents/IncidentDashboard'));
const ShrimpSizeDashboard = lazy(() => import('../features/shrimp-size/ShrimpSizeDashboard'));
const BiomassDashboard = lazy(() => import('../features/biomass/BiomassDashboard'));
const SurvivalRateDashboard = lazy(() => import('../features/survival-rate/SurvivalRateDashboard'));
const FcrDashboard = lazy(() => import('../features/fcr/FcrDashboard'));

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [growthSubTab, setGrowthSubTab] = useState<GrowthTabType>('Theo dõi kích cỡ');
  const [growthConfig, setGrowthConfig] = useState<{ farmId?: string; pondId?: string; cropId?: string } | null>(null);
  const [envConfig, setEnvConfig] = useState<{ farmId?: string; pondId?: string } | null>(null);
  const [healthConfig, setHealthConfig] = useState<{ farmId?: string; pondId?: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

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

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Môi trường nước', icon: <Droplets className="w-5 h-5" /> },
    { name: 'Sức khỏe tôm', icon: <HeartPulse className="w-5 h-5" /> },
    { name: 'Theo dõi tăng trưởng', icon: <TrendingUp className="w-5 h-5" /> },
    { name: 'Sự cố & Điều trị', icon: <AlertTriangle className="w-5 h-5" /> },
    { name: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar - Technician Theme (Indigo) */}
      <aside className="w-72 bg-white border-r border-indigo-100 flex flex-col shadow-sm z-10 h-screen max-h-screen">
        <div className="h-20 flex items-center px-8 border-b border-indigo-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shadow-md">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-indigo-900 tracking-tight">Tech Portal</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 custom-scrollbar">
          <p className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider mb-4">Điều hướng</p>
          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeTab === item.name 
                    ? 'bg-indigo-50 text-indigo-700 font-bold shadow-xs border border-indigo-200/60 translate-x-1' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700 font-medium'
                }`}
              >
                <div className={`${activeTab === item.name ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {item.icon}
                </div>
                {item.name}
              </button>
            ))}
          </nav>
        </div>

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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-indigo-100 flex items-center justify-between px-8 z-30 sticky top-0">
          <h1 className="text-2xl font-extrabold text-indigo-900 tracking-tight">{activeTab}</h1>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm kiếm..." 
                className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 outline-none transition-all w-64 text-slate-700 placeholder-slate-400 font-medium"
              />
            </div>
            <NotificationDropdown 
              themeColor="indigo" 
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

        <div className="flex-1 p-8 overflow-y-auto relative z-0 flex items-center justify-center">
          {/* Subtle Background Elements */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-400/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-400/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>

          <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>}>
          {activeTab === 'Cài đặt' ? (
            <div className="w-full max-w-6xl h-full flex flex-col justify-start">
              <AccountSettings />
            </div>
          ) : activeTab === 'Môi trường nước' ? (
            <div className="w-full h-full flex flex-col justify-start overflow-y-auto">
              <EnvironmentDashboard 
                initialFarmId={envConfig?.farmId}
                initialPondId={envConfig?.pondId}
              />
            </div>
          ) : activeTab === 'Dashboard' ? (
            <div className="w-full h-full flex flex-col justify-start max-w-[1400px] mx-auto overflow-y-auto">
              <TechnicianOverviewDashboard 
                initialFarmId={growthConfig?.farmId}
                initialPondId={growthConfig?.pondId}
                initialCropId={growthConfig?.cropId}
              />
            </div>
          ) : activeTab === 'Sức khỏe tôm' ? (
            <div className="w-full h-full flex flex-col justify-start overflow-y-auto">
              <ShrimpHealthDashboard 
                initialFarmId={healthConfig?.farmId}
                initialPondId={healthConfig?.pondId}
              />
            </div>
          ) : activeTab === 'Theo dõi tăng trưởng' ? (
            <div className="w-full h-full flex flex-col justify-start overflow-y-auto">
              {growthSubTab === 'Theo dõi kích cỡ' ? (
                <ShrimpSizeDashboard 
                  viewOnly={false} 
                  onNavigateTab={(tab) => setGrowthSubTab(tab)} 
                  initialFarmId={growthConfig?.farmId}
                  initialPondId={growthConfig?.pondId}
                  onSelectFarm={(farmId) => setGrowthConfig(prev => ({ ...prev, farmId }))}
                  onSelectPond={(pondId) => setGrowthConfig(prev => ({ ...prev, pondId }))}
                />
              ) : growthSubTab === 'Sinh khối ao' ? (
                <BiomassDashboard 
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
          ) : activeTab === 'Sự cố & Điều trị' ? (
            <div className="w-full h-full flex flex-col justify-start overflow-y-auto">
              <IncidentDashboard role="TECHNICIAN" />
            </div>
          ) : (
            <div className="text-center p-12 bg-white border border-indigo-100 rounded-3xl shadow-sm max-w-xl">
              <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Wrench className="w-12 h-12 text-indigo-500" />
              </div>
              <h2 className="text-2xl font-black text-indigo-900 mb-3">Khu Vực Kỹ Thuật Viên</h2>
              <p className="text-slate-500 text-lg">
                Giao diện và các tính năng chi tiết dành cho chuyên gia kỹ thuật sẽ được phát triển và tích hợp trong các bản cập nhật sắp tới.
              </p>
            </div>
          )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
