import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear any stored authentication data
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Redirect to login page
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-blue-800">SSFM</div>
        <nav className="flex-1 p-4 space-y-2">
          <a href="#" className="block p-2 rounded hover:bg-blue-800">Dashboard</a>
          <a href="#" className="block p-2 rounded hover:bg-blue-800">Quản lý Ao/Vụ</a>
          <a href="#" className="block p-2 rounded hover:bg-blue-800 bg-blue-800">5T Care Loop</a>
          <a href="#" className="block p-2 rounded hover:bg-blue-800">Môi trường</a>
          <a href="#" className="block p-2 rounded hover:bg-blue-800">Trợ lý AI</a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">5T Care Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Xin chào, Admin</span>
            <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-gray-500 text-sm font-medium">Tỷ lệ sống ước tính</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">89%</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-gray-500 text-sm font-medium">FCR Hiện tại</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">1.12</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-gray-500 text-sm font-medium">Trạng thái Cảnh báo</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">Cần hiệu chỉnh</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-64 flex items-center justify-center">
          <p className="text-gray-400">[Biểu đồ Tăng trưởng 5T Placeholder]</p>
        </div>
      </main>
    </div>
  );
}
