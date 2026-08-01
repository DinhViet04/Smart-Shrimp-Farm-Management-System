import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Bell, 
  Search, 
  Wrench,
  Droplets,
  HeartPulse,
  AlertTriangle,
} from 'lucide-react';

import AccountSettings from '../components/AccountSettings';
import EnvironmentDashboard from '../features/environment/EnvironmentDashboard';
import EnvironmentTrendDashboard from '../features/environment/EnvironmentTrendDashboard';
import ShrimpHealthDashboard from '../features/shrimp-health/ShrimpHealthDashboard';
import IncidentDashboard from '../features/incidents/IncidentDashboard';

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Dashboard');
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
    { name: 'Sự cố & Điều trị', icon: <AlertTriangle className="w-5 h-5" /> },
    { name: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar - Technician Theme (Indigo) */}
      <aside className="w-72 bg-white border-r border-indigo-100 flex flex-col shadow-sm z-10">
        <div className="h-20 flex items-center px-8 border-b border-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shadow-md">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-indigo-900 tracking-tight">Tech Portal</span>
          </div>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider mb-4">Điều hướng</p>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                  activeTab === item.name 
                    ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm border border-indigo-200/60 translate-x-1' 
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

        <div className="mt-auto p-6 border-t border-indigo-50">
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
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-indigo-100 flex items-center justify-between px-8 z-10 sticky top-0">
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
            <button className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-100 rounded-full hover:bg-indigo-50">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto relative z-0 flex items-center justify-center">
          {/* Subtle Background Elements */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-400/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-400/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>

          {activeTab === 'Cài đặt' ? (
            <div className="w-full max-w-6xl h-full flex flex-col justify-start">
              <AccountSettings />
            </div>
          ) : activeTab === 'Môi trường nước' ? (
            <div className="w-full h-full flex flex-col justify-start overflow-y-auto">
              <EnvironmentDashboard />
            </div>
          ) : activeTab === 'Dashboard' ? (
            <div className="w-full h-full flex flex-col justify-start max-w-[1400px] mx-auto">
              <EnvironmentTrendDashboard />
            </div>
          ) : activeTab === 'Sức khỏe tôm' ? (
            <div className="w-full h-full flex flex-col justify-start overflow-y-auto">
              <ShrimpHealthDashboard />
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
        </div>
      </main>
    </div>
  );
}
