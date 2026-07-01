import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, MapPin, Maximize, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import { farmService } from '../../services/farm.service';
import FarmFormModal from './FarmFormModal';
import FarmDetailPanel from './FarmDetailPanel';

export default function FarmList() {
  const [farms, setFarms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<any>(null);
  
  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [farmToDelete, setFarmToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // View Modal State
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingFarm, setViewingFarm] = useState<any>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canEdit = user.role === 'FARM_MANAGER' || user.role === 'ADMIN';

  const fetchFarms = async () => {
    setIsLoading(true);
    try {
      const data = await farmService.getAll(search);
      setFarms(data);
    } catch (error) {
      showToast('Không thể tải danh sách trang trại', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search slightly
    const timer = setTimeout(() => {
      fetchFarms();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async () => {
    if (!farmToDelete) return;
    setIsDeleting(true);
    try {
      await farmService.remove(farmToDelete.id);
      showToast('Xóa trang trại thành công!', 'success');
      fetchFarms();
    } catch (error: any) {
      showToast(error.message || 'Không thể xóa trang trại này', 'error');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setFarmToDelete(null);
    }
  };

  const handleOpenForm = (farm?: any) => {
    setEditingFarm(farm || null);
    setIsModalOpen(true);
  };

  const handleViewFarm = (farm: any) => {
    setViewingFarm(farm);
    setIsViewOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative">
      {/* Custom Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-right-8 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Danh Sách Trang Trại</h2>
            <p className="text-sm text-slate-500">Quản lý tổng quan các khu vực nuôi trồng</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên trang trại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
          {canEdit && (
            <button
              onClick={() => handleOpenForm()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-sm shadow-blue-600/20 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {/* List / Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 text-sm font-medium">Đang tải dữ liệu...</p>
          </div>
        </div>
      ) : farms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-slate-100 shadow-sm text-center px-6">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">Chưa có trang trại nào</h3>
          <p className="text-slate-500 text-sm mb-4">Bạn có thể thêm trang trại mới để bắt đầu quản lý.</p>
          {canEdit && (
            <button
              onClick={() => handleOpenForm()}
              className="text-blue-600 font-semibold text-sm hover:underline flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Thêm trang trại ngay
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {farms.map((farm) => (
            <div 
              key={farm.id} 
              onClick={() => handleViewFarm(farm)}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 group flex flex-col cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-800 line-clamp-1 flex-1 pr-2" title={farm.name}>
                  {farm.name}
                </h3>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border whitespace-nowrap ${
                  farm.status === 'ACTIVE' 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {farm.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}
                </span>
              </div>
              
              <div className="space-y-3 mb-6 flex-1">
                <div className="flex items-start gap-2 text-slate-500 text-sm">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
                  <span className="line-clamp-2">{farm.address}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Maximize className="w-4 h-4 flex-shrink-0 text-slate-400" />
                  <span>{farm.area.toLocaleString()} m²</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                    {farm.ponds?.length || 0}
                  </div>
                  <span>ao nuôi</span>
                </div>
              </div>

              {canEdit && (
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenForm(farm); }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFarmToDelete(farm);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Xóa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Farm Form Modal */}
      <FarmFormModal
        isOpen={isModalOpen}
        initialData={editingFarm}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(msg) => {
          showToast(msg, 'success');
          fetchFarms();
        }}
      />

      {/* Farm Detail Panel */}
      <FarmDetailPanel
        isOpen={isViewOpen}
        farm={viewingFarm}
        onClose={() => setIsViewOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-slate-500 text-sm mb-6">
              Bạn có chắc chắn muốn xóa trang trại <span className="font-semibold text-slate-700">{farmToDelete?.name}</span>? 
              Thao tác này không thể hoàn tác nếu không có liên kết với ao nuôi.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-sm"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Xóa ngay'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
