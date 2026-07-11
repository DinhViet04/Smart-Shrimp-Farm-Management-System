import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertCircle, CheckCircle2, FlaskConical, Pill, Box } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { farmService } from '../../services/farm.service';
import InventoryFormModal from './InventoryFormModal';

export default function InventoryManagement() {
  const [inventories, setInventories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canEdit = user.role === 'FARM_MANAGER';

  const fetchInventories = async (farmId: string) => {
    if (!farmId) return;
    setIsLoading(true);
    try {
      const data = await inventoryService.getAll(search, categoryFilter, farmId);
      setInventories(data.data || []);
    } catch (error) {
      showToast('Không thể tải danh sách vật tư', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFarms = async () => {
    try {
      const data = await farmService.getAll();
      setFarms(data);
      if (data.length > 0 && !selectedFarmId) {
        setSelectedFarmId(data[0].id);
      }
    } catch (error) {
      showToast('Không thể tải danh sách trang trại', 'error');
    }
  };

  useEffect(() => {
    fetchFarms();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInventories(selectedFarmId);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, selectedFarmId]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await inventoryService.remove(itemToDelete.id);
      showToast('Xóa vật tư thành công!', 'success');
      fetchInventories(selectedFarmId);
    } catch (error: any) {
      showToast(error.message || 'Không thể xóa vật tư này', 'error');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const handleOpenForm = (item?: any) => {
    setEditingItem(item || null);
    setIsModalOpen(true);
  };

  const getCategoryDetails = (category: string) => {
    switch(category) {
      case 'FEED': return { label: 'Thức ăn', icon: <Package className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' };
      case 'MEDICINE': return { label: 'Thuốc', icon: <Pill className="w-4 h-4" />, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' };
      case 'CHEMICAL': return { label: 'Hóa chất', icon: <FlaskConical className="w-4 h-4" />, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' };
      default: return { label: 'Khác', icon: <Box className="w-4 h-4" />, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-right-8 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100/50">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight">Kho Vật tư & Thức ăn</h2>
            <p className="text-sm text-slate-500 font-medium">Quản lý các loại thức ăn, thuốc, hóa chất</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {farms.length > 0 && (
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm cursor-pointer"
            >
              {farms.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm cursor-pointer"
          >
            <option value="ALL">Tất cả danh mục</option>
            <option value="FEED">Thức ăn</option>
            <option value="MEDICINE">Thuốc</option>
            <option value="CHEMICAL">Hóa chất</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên vật tư..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-inner"
            />
          </div>

          {canEdit && (
            <button
              onClick={() => handleOpenForm()}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-sm">
                <th className="px-6 py-4 font-bold text-slate-600">Tên vật tư</th>
                <th className="px-6 py-4 font-bold text-slate-600">Phân loại</th>
                <th className="px-6 py-4 font-bold text-slate-600">Tồn kho</th>
                <th className="px-6 py-4 font-bold text-slate-600">Nhà cung cấp</th>
                {canEdit && <th className="px-6 py-4 font-bold text-slate-600 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
                    </div>
                  </td>
                </tr>
              ) : inventories.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Package className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">Không tìm thấy vật tư nào.</p>
                  </td>
                </tr>
              ) : (
                inventories.map((item) => {
                  const cat = getCategoryDetails(item.category);
                  const isLowStock = item.quantity <= item.minThreshold;

                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-800">{item.itemName}</p>
                          {item.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1 max-w-xs">{item.description}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cat.bg} ${cat.color} ${cat.border}`}>
                          {cat.icon}
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {item.packageType && item.packageQty != null ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-black ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                                {item.packageQty}
                              </span>
                              <span className="text-sm font-medium text-slate-500">{item.packageType}</span>
                              <span className="text-xs text-slate-400 font-medium">
                                (Tổng: {item.quantity} {item.unit})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-black ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                                {item.quantity}
                              </span>
                              <span className="text-sm font-medium text-slate-500">{item.unit}</span>
                            </div>
                          )}
                          
                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                              <AlertCircle className="w-3 h-3" />
                              Sắp hết
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-600">{item.supplier || '-'}</span>
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenForm(item)}
                              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                              title="Sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setItemToDelete(item);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      <InventoryFormModal
        isOpen={isModalOpen}
        initialData={editingItem}
        selectedFarmId={selectedFarmId}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(msg) => {
          showToast(msg, 'success');
          fetchInventories(selectedFarmId);
        }}
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
              Bạn có chắc chắn muốn xóa vật tư <span className="font-semibold text-slate-700">{itemToDelete?.itemName}</span>? 
              Hệ thống sẽ không cho phép xóa nếu vật tư này đã có nhật ký sử dụng.
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
