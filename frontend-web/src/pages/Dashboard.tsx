import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, LayoutDashboard, Waves, LineChart, Thermometer, Bot, LogOut, Bell, Search, Activity, AlertCircle, Settings } from 'lucide-react';
import AccountSettings from '../components/AccountSettings';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Dashboard');

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Quản lý Ao/Vụ', icon: <Waves className="w-5 h-5" /> },
    { name: '5T Care Loop', icon: <LineChart className="w-5 h-5" /> },
    { name: 'Môi trường', icon: <Thermometer className="w-5 h-5" /> },
    { name: 'Trợ lý AI', icon: <Bot className="w-5 h-5" /> },
    { name: 'Cài đặt', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
        <div className="h-20 flex items-center px-8 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img src="/logonen.jpg" alt="SSFM Logo" className="w-10 h-10 rounded-full object-cover bg-white shadow-sm border border-slate-200" />
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">SSFM</span>
          </div>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Nông Trại của bạn</p>
          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeTab === item.name 
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm border border-blue-100/50' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              >
                <div className={`${activeTab === item.name ? 'text-blue-600' : 'text-slate-400'}`}>
                  {item.icon}
                </div>
                {item.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              ND
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">Nông Dân A</p>
              <p className="text-xs text-slate-500 truncate">Trại tôm Bạc Liêu</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{activeTab}</h1>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm kiếm thông tin..." 
                className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-200 outline-none transition-all w-64"
              />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto bg-slate-50 relative">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-[100px] pointer-events-none"></div>

          {activeTab === 'Dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
              
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm shadow-slate-200/50 border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      <Activity className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg border border-emerald-100">Ổn định</span>
                  </div>
                  <h3 className="text-slate-500 text-sm font-semibold mb-1">Tỷ lệ sống ước tính</h3>
                  <div className="flex items-end gap-2">
                    <p className="text-4xl font-black text-slate-800">89<span className="text-2xl text-slate-400 font-bold">%</span></p>
                    <span className="text-emerald-500 text-sm font-bold mb-1.5">+2.4%</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm shadow-slate-200/50 border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <LineChart className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg border border-blue-100">Tốt</span>
                  </div>
                  <h3 className="text-slate-500 text-sm font-semibold mb-1">FCR Hiện tại</h3>
                  <div className="flex items-end gap-2">
                    <p className="text-4xl font-black text-slate-800">1.12</p>
                    <span className="text-emerald-500 text-sm font-bold mb-1.5">-0.05</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-6 rounded-3xl shadow-lg shadow-amber-500/20 border border-amber-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group text-white">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center backdrop-blur-sm">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-amber-100 text-sm font-semibold mb-1">Trạng thái Môi trường</h3>
                  <div className="flex items-end gap-2">
                    <p className="text-2xl font-black text-white leading-tight">Cần hiệu chỉnh<br/>Oxy ao B2</p>
                  </div>
                </div>
              </div>

              {/* Main Chart Area */}
              <div className="bg-white p-8 rounded-3xl shadow-sm shadow-slate-200/50 border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-slate-800">Biểu đồ Sinh trưởng 5T</h2>
                  <select className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none cursor-pointer">
                    <option>Vụ nuôi hiện tại</option>
                    <option>Tháng qua</option>
                  </select>
                </div>
                <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <LineChart className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Khu vực hiển thị biểu đồ sinh trưởng</p>
                  <p className="text-slate-400 text-sm mt-1">Dữ liệu sẽ được tự động cập nhật từ cảm biến</p>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'Cài đặt' ? (
            <AccountSettings />
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
        </div>
      </main>
    </div>
  );
}
