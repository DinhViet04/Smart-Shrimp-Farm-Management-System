import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, MapPin, Maximize, AlertCircle, Building2, CheckCircle2, Eye, Waves, User } from 'lucide-react';
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
  const canEdit = user.role === 'FARM_MANAGER';

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100/50">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500 tracking-tight">Danh Sách Trang Trại</h2>
            <p className="text-sm text-slate-500 font-medium">Quản lý tổng quan các khu vực nuôi trồng</p>
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
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-inner"
            />
          </div>
          {canEdit && (
            <button
              onClick={() => handleOpenForm()}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 whitespace-nowrap"
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
              className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all hover:-translate-y-1.5 duration-500 group flex flex-col cursor-pointer overflow-hidden relative"
            >
              <div className="h-24 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/20 backdrop-blur-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              </div>
              <div className="p-6 relative flex-1 flex flex-col">
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleViewFarm(farm); }}
                    className="p-2 bg-white/90 text-blue-600 hover:bg-blue-50 rounded-xl shadow-sm transition-colors"
                    title="Xem chi tiết"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenForm(farm); }}
                        className="p-2 bg-white/90 text-blue-600 hover:bg-blue-50 rounded-xl shadow-sm transition-colors"
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
                        className="p-2 bg-white/90 text-rose-600 hover:bg-rose-50 rounded-xl shadow-sm transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                <div className="w-14 h-14 bg-white border border-white/80 rounded-2xl flex items-center justify-center absolute -top-10 shadow-xl shadow-blue-900/10 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-500 z-20">
                  <Building2 className="w-7 h-7 text-blue-600" />
                </div>
                
                <div className="mt-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-slate-800 line-clamp-1 flex-1 pr-2" title={farm.name}>
                      {farm.name}
                    </h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border whitespace-nowrap ${
                      farm.status === 'ACTIVE' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}>
                      {farm.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}
                    </span>
                    
                    {user.role === 'ADMIN' && farm.owner && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border whitespace-nowrap bg-indigo-50 text-indigo-600 border-indigo-100">
                        <User className="w-3.5 h-3.5" />
                        {farm.owner.fullName || 'Không rõ'}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-4 mb-2 flex-1">
                    <div className="flex items-start gap-2 text-slate-600 text-sm bg-slate-50/80 p-3 rounded-xl border border-slate-100/50 shadow-inner">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                      <span className="line-clamp-2 font-medium leading-relaxed">{farm.address}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 flex flex-col gap-1 items-start transition-colors group-hover:bg-blue-50">
                        <div className="flex items-center gap-1.5 text-blue-600/80 text-xs font-bold uppercase tracking-wider">
                          <Maximize className="w-3.5 h-3.5" />
                          Diện tích
                        </div>
                        <p className="text-lg font-black text-slate-800">{farm.area.toLocaleString()} <span className="text-sm font-bold text-slate-400">m²</span></p>
                      </div>
                      <div className="bg-cyan-50/50 p-3 rounded-2xl border border-cyan-100/50 flex flex-col gap-1 items-start transition-colors group-hover:bg-cyan-50">
                        <div className="flex items-center gap-1.5 text-cyan-600/80 text-xs font-bold uppercase tracking-wider">
                          <Waves className="w-3.5 h-3.5" />
                          Số ao nuôi
                        </div>
                        <p className="text-lg font-black text-slate-800">{farm.ponds?.length || 0} <span className="text-sm font-bold text-slate-400">ao</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
