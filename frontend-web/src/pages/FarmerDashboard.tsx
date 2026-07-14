import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Waves, 
  Droplets, 
  ClipboardList, 
  Settings, 
  LogOut, 
  Bell, 
  Search, 
  Leaf,
  Activity,
  AlertCircle,
  Package
} from 'lucide-react';

// Import AccountSettings from existing component so user can still edit profile
import AccountSettings from '../components/AccountSettings';
import InventoryManagement from '../features/inventory/InventoryManagement';

export default function FarmerDashboard() {
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
    { name: 'Quản lý Ao của tôi', icon: <Waves className="w-5 h-5" /> },
    { name: 'Ghi chép Môi trường', icon: <Droplets className="w-5 h-5" /> },
    { name: 'Nhật ký Chăm sóc', icon: <ClipboardList className="w-5 h-5" /> },
    { name: 'Kho thức ăn', icon: <Package className="w-5 h-5" /> },
    { name: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-stone-50 font-sans overflow-hidden">
      {/* Sidebar - Earthy / Nature Theme */}
      <aside className="w-72 bg-white border-r border-teal-100 flex flex-col shadow-sm z-10">
        <div className="h-20 flex items-center px-8 border-b border-teal-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center shadow-md">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-teal-800 tracking-tight">Farmer App</span>
          </div>
        </div>
        
        <div className="px-6 py-4">
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

        <div className="mt-auto p-6 border-t border-teal-50">
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
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-teal-100 flex items-center justify-between px-8 z-10 sticky top-0">
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
            <button className="relative p-2 text-stone-400 hover:text-teal-600 transition-colors bg-stone-100 rounded-full hover:bg-teal-50">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto relative z-0">
          {/* Subtle Background Elements */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-400/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-400/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>

          {activeTab === 'Dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8">
              
              {/* Stat Cards - Nature Theme */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-teal-100 hover:shadow-md hover:border-teal-200 transition-all duration-300 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Waves className="w-24 h-24 text-teal-600" />
                  </div>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
                      <Waves className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg border border-teal-100">Của tôi</span>
                  </div>
                  <h3 className="text-stone-500 text-sm font-semibold mb-1 relative z-10">Tổng số Ao phụ trách</h3>
                  <div className="flex items-end gap-2 relative z-10">
                    <p className="text-4xl font-black text-teal-900">4<span className="text-xl text-stone-400 font-bold ml-1">Ao</span></p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-teal-100 hover:shadow-md hover:border-teal-200 transition-all duration-300 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Activity className="w-24 h-24 text-emerald-600" />
                  </div>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Activity className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">Bình thường</span>
                  </div>
                  <h3 className="text-stone-500 text-sm font-semibold mb-1 relative z-10">Sức khỏe tôm (Ước tính)</h3>
                  <div className="flex items-end gap-2 relative z-10">
                    <p className="text-4xl font-black text-teal-900">92<span className="text-xl text-stone-400 font-bold ml-1">%</span></p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-teal-600 to-emerald-600 p-6 rounded-3xl shadow-lg shadow-teal-600/20 border border-teal-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group text-white relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-20">
                    <AlertCircle className="w-32 h-32 text-white" />
                  </div>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center backdrop-blur-md border border-white/30">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-lg border border-white/30 backdrop-blur-md">Chú ý</span>
                  </div>
                  <h3 className="text-teal-50 text-sm font-semibold mb-1 relative z-10">Cảnh báo môi trường</h3>
                  <div className="flex items-end gap-2 relative z-10">
                    <p className="text-2xl font-black text-white leading-tight">Cần đo lại pH<br/>Ao số 3</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Recent Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Quick Actions */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-teal-100">
                  <h2 className="text-xl font-bold text-teal-900 mb-6 flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-teal-500" />
                    Thao tác nhanh
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setActiveTab('Ghi chép Môi trường')} className="flex flex-col items-center justify-center p-6 bg-teal-50/50 border border-teal-100 rounded-2xl hover:bg-teal-50 hover:border-teal-200 transition-colors group">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm text-teal-600 mb-3 group-hover:scale-110 transition-transform">
                        <Droplets className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-teal-800 text-sm text-center">Ghi nhận thông số Nước</span>
                    </button>
                    <button onClick={() => setActiveTab('Nhật ký Chăm sóc')} className="flex flex-col items-center justify-center p-6 bg-emerald-50/50 border border-emerald-100 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 transition-colors group">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm text-emerald-600 mb-3 group-hover:scale-110 transition-transform">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-emerald-800 text-sm text-center">Nhật ký Cho ăn</span>
                    </button>
                  </div>
                </div>

                {/* Status List */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-teal-100">
                  <h2 className="text-xl font-bold text-teal-900 mb-6 flex items-center gap-2">
                    <Waves className="w-5 h-5 text-teal-500" />
                    Trạng thái Ao của bạn
                  </h2>
                  <div className="space-y-4">
                    {[
                      { name: 'Ao số 1 (Giai đoạn đầu)', status: 'Tốt', temp: '29°C', ph: '7.8' },
                      { name: 'Ao số 2 (Sắp thu hoạch)', status: 'Tốt', temp: '28°C', ph: '7.6' },
                      { name: 'Ao số 3 (Mới thả giống)', status: 'Cần chú ý', temp: '30°C', ph: '8.2' },
                    ].map((pond, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 border border-stone-100 rounded-2xl hover:bg-stone-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${pond.status === 'Tốt' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                          <div>
                            <p className="font-bold text-stone-800">{pond.name}</p>
                            <p className="text-xs font-semibold text-stone-500">Nhiệt độ: {pond.temp} • pH: {pond.ph}</p>
                          </div>
                        </div>
                        <button onClick={() => setActiveTab('Quản lý Ao của tôi')} className="text-teal-600 font-bold text-sm bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100 transition-colors">
                          Xem
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'Cài đặt' ? (
             <AccountSettings />
          ) : activeTab === 'Kho thức ăn' ? (
             <InventoryManagement />
          ) : activeTab !== 'Dashboard' ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-12 bg-white border border-teal-100 rounded-3xl shadow-sm max-w-lg">
                <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  {activeTab === 'Quản lý Ao của tôi' && <Waves className="w-12 h-12 text-teal-500" />}
                  {activeTab === 'Ghi chép Môi trường' && <Droplets className="w-12 h-12 text-teal-500" />}
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
        </div>
      </main>
    </div>
  );
}
