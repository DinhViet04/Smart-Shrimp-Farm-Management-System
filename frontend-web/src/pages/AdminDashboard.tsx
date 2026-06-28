import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const userStr = localStorage.getItem('user');
const currentUser = userStr ? JSON.parse(userStr) : { fullName: 'Admin', email: 'admin@ssfm.com' };

// ── Mini SVG charts ─────────────────────────────────────────────────────────
function TrendLine({ color = '#2563eb' }: { color?: string }) {
  const pts = [0, 8, 4, 14, 10, 20, 15, 22, 18];
  const maxY = 22;
  const w = 80;
  const h = 30;
  const points = pts
    .map((v, i) => `${(i / (pts.length - 1)) * w},${h - (v / maxY) * h}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-8">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function BarChart({ data, color = '#2563eb' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80"
            style={{ height: `${(v / max) * 100}%`, backgroundColor: color }}
          />
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 40;
  const cx = 55;
  const cy = 55;
  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const frac = seg.value / total;
    const start = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += frac;
    const end = cumulative * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = frac > 0.5 ? 1 : 0;
    return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: seg.color };
  });
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 110 110" className="w-32 h-32 drop-shadow-sm">
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} className="transition-all duration-300 hover:opacity-80" />)}
        <circle cx={cx} cy={cy} r="26" fill="white" />
      </svg>
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────
const navItems = [
  { label: 'Tổng quan', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', active: true },
  { label: 'Người dùng', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', active: false },
  { label: 'Trang trại', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', active: false },
  { label: 'Báo cáo', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', active: false },
  { label: 'Chuẩn 5T', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', active: false },
  { label: 'Cảnh báo', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', active: false },
];

const adminItems = [
  { label: 'Cài đặt', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'Bảo mật', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
];

const roleBadge: Record<string, string> = {
  ADMIN: 'bg-rose-100 text-rose-700',
  FARM_MANAGER: 'bg-emerald-100 text-emerald-700',
  TECHNICIAN: 'bg-amber-100 text-amber-700',
  FARMER: 'bg-blue-100 text-blue-700',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('adminActiveTab') || 'Tổng quan');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3000/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Override colors for the new theme if necessary
        const themeStats = {
          ...data,
          roleDistrib: data.roleDistrib?.map((r: any) => ({
            ...r,
            color: r.label === 'Admin' ? '#f43f5e' : r.label === 'Quản lý' ? '#10b981' : r.label === 'Kỹ thuật' ? '#f59e0b' : '#3b82f6'
          })),
          statCards: data.statCards?.map((c: any) => ({
            ...c,
            color: c.up ? '#10b981' : (c.color === '#6366f1' ? '#3b82f6' : c.color)
          }))
        };
        setStats(themeStats);
      } else {
        // Fallback for visual testing
        setStats({
          statCards: [
            { label: 'Tổng người dùng', value: '1,248', change: '+12%', up: true, color: '#3b82f6' },
            { label: 'Trang trại hoạt động', value: '426', change: '+5%', up: true, color: '#10b981' },
            { label: 'Cảnh báo hệ thống', value: '12', change: '-2%', up: false, color: '#f59e0b' },
            { label: 'Doanh thu (Demo)', value: '$12,400', change: '+18%', up: true, color: '#06b6d4' }
          ],
          growthData: [12, 19, 15, 25, 22, 30, 28],
          growthLabels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
          recentActivity: [
            { text: 'Trại A vùa tạo vụ mới', sub: '2 phút trước', color: 'bg-blue-500' },
            { text: 'Cảnh báo DO thấp ở Ao B2', sub: '15 phút trước', color: 'bg-amber-500' },
            { text: 'User mới đăng ký: Nông Dân C', sub: '1 giờ trước', color: 'bg-emerald-500' }
          ],
          roleDistrib: [
            { label: 'Admin', value: 3, color: '#f43f5e' },
            { label: 'Quản lý', value: 45, color: '#10b981' },
            { label: 'Kỹ thuật', value: 82, color: '#f59e0b' },
            { label: 'Nông dân', value: 320, color: '#3b82f6' }
          ]
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3000/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3000/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (response.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        alert('Cập nhật quyền thất bại!');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Lỗi kết nối!');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: boolean) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3000/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: newStatus })
      });
      if (response.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, isActive: newStatus } : u));
      } else {
        alert('Cập nhật trạng thái thất bại!');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Lỗi kết nối!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden selection:bg-blue-200">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shadow-sm z-20`}
      >
        {/* Logo */}
        <div className="flex items-center h-20 px-6 border-b border-slate-100 gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md">
            S
          </div>
          {sidebarOpen && <span className="font-bold text-slate-800 text-xl tracking-tight whitespace-nowrap">SSFM Admin</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <a
              key={item.label}
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab(item.label); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold ${activeTab === item.label
                  ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
            >
              <svg className={`w-5 h-5 flex-shrink-0 ${activeTab === item.label ? 'text-blue-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
            </a>
          ))}

          {sidebarOpen && <p className="px-4 pt-6 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Hệ thống</p>}
          {adminItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm font-semibold"
            >
              <svg className="w-5 h-5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {sidebarOpen && <span>{item.label}</span>}
            </a>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={handleLogout}
            className={`flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-100 border border-transparent transition-all text-sm font-semibold`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Decorative BG */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Top bar */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center px-8 gap-6 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-blue-600 transition-colors p-2 bg-slate-100 hover:bg-blue-50 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative group">
              <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Tìm kiếm nhanh..."
                className="w-full bg-slate-100 border border-transparent rounded-full pl-11 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-5 ml-auto">
            {/* Bell */}
            <button className="relative p-2.5 text-slate-400 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-full transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
            </button>

            <div className="w-px h-8 bg-slate-200"></div>

            {/* Avatar */}
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                {currentUser.fullName?.[0] ?? 'A'}
              </div>
              <div className="hidden sm:block text-sm">
                <p className="font-bold text-slate-800 leading-none group-hover:text-blue-600 transition-colors">{currentUser.fullName ?? 'Admin'}</p>
                <p className="text-slate-500 text-xs mt-1 font-medium">System Admin</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{activeTab}</h1>
                <p className="text-slate-500 text-sm mt-1 font-medium">Theo dõi và quản lý các hoạt động mới nhất.</p>
              </div>
              {activeTab === 'Người dùng' && (
                <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-6 py-3 rounded-full transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm người dùng
                </button>
              )}
            </div>

            {activeTab === 'Tổng quan' && (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {stats?.statCards?.map((card: any) => (
                    <div key={card.label} className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col gap-4 shadow-sm shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-500 mb-1">{card.label}</p>
                          <p className="text-3xl font-black text-slate-800">{card.value}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-1 border border-slate-100">
                          <TrendLine color={card.color} />
                        </div>
                      </div>
                      <p className={`text-sm font-bold flex items-center gap-1 ${card.up ? 'text-emerald-500' : 'text-red-500'}`}>
                        {card.change}
                        <span className="text-slate-400 font-medium text-xs ml-1">vs tháng trước</span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Middle row: User growth + Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  {/* User growth chart */}
                  <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm shadow-slate-200/50">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-lg font-bold text-slate-800">Tăng trưởng Người dùng</h2>
                      <select className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none">
                        <option>7 ngày qua</option>
                        <option>30 ngày qua</option>
                      </select>
                    </div>
                    <BarChart data={stats?.growthData || []} color="#3b82f6" />
                    <div className="flex justify-between mt-4 border-t border-slate-100 pt-3">
                      {stats?.growthLabels?.map((l: string) => (
                        <span key={l} className="text-xs font-semibold text-slate-400 flex-1 text-center">{l}</span>
                      ))}
                    </div>
                  </div>

                  {/* Recent activity */}
                  <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm shadow-slate-200/50 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-bold text-slate-800">Hoạt động mới</h2>
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-semibold">Xem tất cả</button>
                    </div>
                    <div className="space-y-6 flex-1">
                      {stats?.recentActivity?.map((item: any, i: number) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${item.color} shadow-sm shadow-${item.color.split('-')[1]}-500/40`} />
                          <div>
                            <p className="text-sm text-slate-700 font-bold leading-tight mb-1">{item.text}</p>
                            <p className="text-xs font-medium text-slate-400">{item.sub}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'Người dùng' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Users table */}
                <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/50 overflow-hidden">
                  <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Danh sách Người dùng</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/80 text-left border-b border-slate-100">
                          <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                          <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Người dùng</th>
                          <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vai trò</th>
                          <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                          <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày tham gia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingUsers ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12">
                              <div className="inline-block animate-spin w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full"></div>
                              <p className="mt-4 text-slate-500 font-medium">Đang tải dữ liệu...</p>
                            </td>
                          </tr>
                        ) : users.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-slate-500 font-medium">Chưa có người dùng nào</td>
                          </tr>
                        ) : (
                          users.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-8 py-4 font-mono text-blue-600 font-semibold text-xs">#{u.id.substring(0, 8)}</td>
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs">
                                    {u.fullName[0]}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{u.fullName}</p>
                                    <p className="text-slate-500 text-xs font-medium mt-0.5">{u.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <select
                                  value={u.role}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  className={`px-3 py-1.5 outline-none cursor-pointer rounded-lg text-xs font-bold border border-transparent hover:border-slate-200 transition-all ${roleBadge[u.role] || 'bg-slate-100 text-slate-700'}`}
                                >
                                  <option value="ADMIN" className="bg-white text-slate-800">Admin</option>
                                  <option value="FARM_MANAGER" className="bg-white text-slate-800">Quản lý</option>
                                  <option value="TECHNICIAN" className="bg-white text-slate-800">Kỹ thuật viên</option>
                                  <option value="FARMER" className="bg-white text-slate-800">Nông dân</option>
                                </select>
                              </td>
                              <td className="px-8 py-4">
                                <select
                                  value={u.isActive ? "true" : "false"}
                                  onChange={(e) => handleStatusChange(u.id, e.target.value === 'true')}
                                  className={`px-3 py-1.5 outline-none cursor-pointer rounded-lg text-xs font-bold border border-transparent hover:border-slate-200 transition-all ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    }`}
                                >
                                  <option value="true" className="bg-white text-slate-800">Hoạt động</option>
                                  <option value="false" className="bg-white text-slate-800">Bị khóa</option>
                                </select>
                              </td>
                              <td className="px-8 py-4 text-slate-500 text-sm font-medium">{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Role distribution donut */}
                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm shadow-slate-200/50 flex flex-col">
                  <h2 className="text-lg font-bold text-slate-800 mb-8">Phân bổ Vai trò</h2>
                  <div className="flex-1 flex items-center justify-center mb-8">
                    <DonutChart segments={stats?.roleDistrib || []} />
                  </div>
                  <div className="space-y-4">
                    {stats?.roleDistrib?.map((s: any) => (
                      <div key={s.label} className="flex items-center justify-between text-sm bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-3 font-semibold text-slate-700">
                          <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </div>
                        <span className="font-bold text-slate-900 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
