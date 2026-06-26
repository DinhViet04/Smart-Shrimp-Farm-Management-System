import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const userStr = localStorage.getItem('user');
const currentUser = userStr ? JSON.parse(userStr) : { fullName: 'Admin', email: 'admin@ssfm.com' };

// ── Mini SVG charts ─────────────────────────────────────────────────────────
function TrendLine({ color = '#6366f1' }: { color?: string }) {
  const pts = [0, 8, 4, 14, 10, 20, 15, 22, 18];
  const maxY = 22;
  const w = 80;
  const h = 30;
  const points = pts
    .map((v, i) => `${(i / (pts.length - 1)) * w},${h - (v / maxY) * h}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-8">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function BarChart({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm transition-all"
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
      <svg viewBox="0 0 110 110" className="w-32 h-32">
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)}
        <circle cx={cx} cy={cy} r="24" fill="white" />
      </svg>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
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

// Static data replaced by API call

const roleBadge: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  FARM_MANAGER: 'bg-emerald-100 text-emerald-700',
  TECHNICIAN: 'bg-amber-100 text-amber-700',
  FARMER: 'bg-indigo-100 text-indigo-700',
};
const roleLabel: Record<string, string> = {
  ADMIN: 'Admin',
  FARM_MANAGER: 'Quản lý',
  TECHNICIAN: 'Kỹ thuật viên',
  FARMER: 'Nông dân',
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
        setStats(data);
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
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#f5f6fa] font-sans overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 bg-white border-r border-gray-100 flex flex-col transition-all duration-300 shadow-sm`}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-gray-100 gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            S
          </div>
          {sidebarOpen && <span className="font-bold text-gray-800 text-base whitespace-nowrap">SSFM Admin</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <a
              key={item.label}
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab(item.label); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                activeTab === item.label
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
            </a>
          ))}

          {sidebarOpen && <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Hệ thống</p>}
          {adminItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors text-sm font-medium"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {sidebarOpen && <span>{item.label}</span>}
            </a>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-4 shadow-sm flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search */}
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Tìm kiếm... (Ctrl+K)"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Bell */}
            <button className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Avatar */}
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">
                {currentUser.fullName?.[0] ?? 'A'}
              </div>
              <div className="hidden sm:block text-sm">
                <p className="font-medium text-gray-800 leading-none">{currentUser.fullName ?? 'Admin'}</p>
                <p className="text-gray-400 text-xs mt-0.5">Admin</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{activeTab}</h1>
              <p className="text-gray-400 text-sm mt-0.5">Xin chào! Đây là những gì đang xảy ra.</p>
            </div>
            {activeTab === 'Người dùng' && (
              <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Thêm người dùng
              </button>
            )}
          </div>

          {activeTab === 'Tổng quan' && (
            <>
              {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats?.statCards?.map((card: any) => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">{card.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  </div>
                  <TrendLine color={card.color} />
                </div>
                <p className={`text-xs font-semibold ${card.up ? 'text-emerald-600' : 'text-red-500'}`}>
                  {card.change}
                  <span className="text-gray-400 font-normal"> vs tháng trước</span>
                </p>
              </div>
            ))}
          </div>

          {/* Middle row: User growth + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* User growth chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-800">Người dùng mới (7 ngày qua)</h2>
                <span className="text-xs text-gray-400">Tuần này</span>
              </div>
              <BarChart data={stats?.growthData || []} color="#6366f1" />
              <div className="flex justify-between mt-2">
                {stats?.growthLabels?.map((l: string) => (
                  <span key={l} className="text-[10px] text-gray-400 flex-1 text-center">{l}</span>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Hoạt động gần đây</h2>
              <div className="space-y-4">
                {stats?.recentActivity?.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                    <div>
                      <p className="text-sm text-gray-700 font-medium leading-tight">{item.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </>
          )}

          {activeTab === 'Người dùng' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Bottom row: Recent users + Role distribution */}
            {/* Recent users table */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-800">Người dùng mới đăng ký</h2>
                <a href="#" className="text-xs font-medium text-indigo-600 hover:underline">Xem tất cả</a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-5 py-3 text-xs font-semibold text-indigo-500 uppercase tracking-wider">ID</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tên</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Vai trò</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ngày</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500">Đang tải dữ liệu...</td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500">Chưa có người dùng nào</td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-mono text-indigo-600 font-semibold text-xs">#{u.id.substring(0, 8)}</td>
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-800">{u.fullName}</p>
                            <p className="text-gray-400 text-xs">{u.email}</p>
                          </td>
                          <td className="px-5 py-3">
                            <select 
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className={`px-2 py-1 outline-none cursor-pointer rounded-lg text-xs font-semibold border-2 border-transparent hover:border-gray-200 transition-colors ${roleBadge[u.role] || 'bg-gray-100 text-gray-700'}`}
                            >
                              <option value="ADMIN" className="bg-white text-gray-800">Admin</option>
                              <option value="FARM_MANAGER" className="bg-white text-gray-800">Quản lý</option>
                              <option value="TECHNICIAN" className="bg-white text-gray-800">Kỹ thuật viên</option>
                              <option value="FARMER" className="bg-white text-gray-800">Nông dân</option>
                            </select>
                          </td>
                          <td className="px-5 py-3">
                            <select
                              value={u.isActive ? "true" : "false"}
                              onChange={(e) => handleStatusChange(u.id, e.target.value === 'true')}
                              className={`px-2 py-1 outline-none cursor-pointer rounded-lg text-xs font-semibold border-2 border-transparent hover:border-gray-200 transition-colors ${
                                u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              <option value="true" className="bg-white text-gray-800">Hoạt động</option>
                              <option value="false" className="bg-white text-gray-800">Khóa tài khoản</option>
                            </select>
                          </td>
                          <td className="px-5 py-3 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Role distribution donut */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Phân bổ Vai trò</h2>
              <div className="flex-1 flex items-center justify-center">
                <DonutChart segments={stats?.roleDistrib || []} />
              </div>
              <div className="mt-4 space-y-2">
                {stats?.roleDistrib?.map((s: any) => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </div>
                    <span className="font-semibold text-gray-700">{s.value} người</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </main>
      </div>
    </div>
  );
}
