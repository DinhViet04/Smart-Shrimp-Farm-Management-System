import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertCircle, CheckCircle2, FlaskConical, Pill, Box, TrendingDown, ClipboardList, CalendarDays, MinusCircle, Truck, X } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { farmService } from '../../services/farm.service';
import { supplierService } from '../../services/supplier.service';
import InventoryFormModal from './InventoryFormModal';
import InventoryDetailsModal from './InventoryDetailsModal';

const SUPPLIER_PHONE_REGEX = /^0\d{9}$/;
const SUPPLIER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InventoryManagement() {
  const [inventories, setInventories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [consumptionSummary, setConsumptionSummary] = useState<any>(null);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<any>(null);
  
  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usageItem, setUsageItem] = useState<any>(null);
  const [usageForm, setUsageForm] = useState({
    quantityUsed: '',
    usageDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [isRecordingUsage, setIsRecordingUsage] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    note: '',
  });
  const [supplierErrors, setSupplierErrors] = useState<{ phone?: string; email?: string }>({});
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canManageInventory = user.role === 'FARM_MANAGER';
  const canRecordUsage = user.role === 'FARMER';

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

  const fetchConsumptionData = async (farmId: string) => {
    if (!farmId) return;
    try {
      const [summary, logs] = await Promise.all([
        inventoryService.getConsumptionSummary(farmId, 30),
        inventoryService.getUsageLogs(farmId),
      ]);
      setConsumptionSummary(summary);
      setUsageLogs(logs || []);
    } catch (error) {
      showToast('Không thể tải dữ liệu tiêu thụ', 'error');
    }
  };

  const fetchSuppliers = async (farmId: string) => {
    if (!farmId || !canManageInventory) return;
    try {
      const data = await supplierService.getAll(farmId);
      setSuppliers(data || []);
    } catch (error) {
      showToast('Không thể tải danh sách nhà cung cấp', 'error');
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
      fetchConsumptionData(selectedFarmId);
      fetchSuppliers(selectedFarmId);
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

  const handleOpenUsageForm = (item: any) => {
    setUsageItem(item);
    setUsageForm({
      quantityUsed: '',
      usageDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  };

  const handleRecordUsage = async (e: FormEvent) => {
    e.preventDefault();
    if (!usageItem) return;

    const quantityUsed = Number(usageForm.quantityUsed);
    if (!quantityUsed || quantityUsed <= 0) {
      showToast('Số lượng tiêu thụ phải lớn hơn 0', 'error');
      return;
    }

    setIsRecordingUsage(true);
    try {
      await inventoryService.recordUsage(usageItem.id, {
        quantityUsed,
        usageDate: usageForm.usageDate,
        notes: usageForm.notes || undefined,
      });
      showToast('Đã ghi nhận tiêu thụ thức ăn', 'success');
      setUsageItem(null);
      fetchInventories(selectedFarmId);
      fetchConsumptionData(selectedFarmId);
    } catch (error: any) {
      showToast(error.message || 'Không thể ghi nhận tiêu thụ', 'error');
    } finally {
      setIsRecordingUsage(false);
    }
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value || 0);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
  };

  const handleOpenSupplierForm = (supplier?: any) => {
    setEditingSupplier(supplier || null);
    setSupplierForm({
      name: supplier?.name || '',
      phone: supplier?.phone || '',
      email: supplier?.email || '',
      address: supplier?.address || '',
      note: supplier?.note || '',
    });
    setSupplierErrors({});
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) return;

    const phone = supplierForm.phone.trim();
    const email = supplierForm.email.trim();
    const errors: { phone?: string; email?: string } = {};

    if (phone && !SUPPLIER_PHONE_REGEX.test(phone)) {
      errors.phone = 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng 0.';
    }

    if (email && !SUPPLIER_EMAIL_REGEX.test(email)) {
      errors.email = 'Email không hợp lệ.';
    }

    if (Object.keys(errors).length > 0) {
      setSupplierErrors(errors);
      return;
    }

    setIsSavingSupplier(true);
    try {
      const payload = {
        ...supplierForm,
        name: supplierForm.name.trim(),
        farmId: selectedFarmId,
        phone: phone || undefined,
        email: email || undefined,
        address: supplierForm.address.trim() || undefined,
        note: supplierForm.note.trim() || undefined,
      };

      if (editingSupplier) {
        await supplierService.update(editingSupplier.id, payload);
        showToast('Cập nhật nhà cung cấp thành công', 'success');
      } else {
        await supplierService.create(payload);
        showToast('Thêm nhà cung cấp thành công', 'success');
      }

      setIsSupplierModalOpen(false);
      setEditingSupplier(null);
      fetchSuppliers(selectedFarmId);
    } catch (error: any) {
      showToast(error.message || 'Không thể lưu nhà cung cấp', 'error');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplier: any) => {
    if (!window.confirm(`Xóa nhà cung cấp "${supplier.name}"?`)) return;

    try {
      await supplierService.remove(supplier.id);
      showToast('Xóa nhà cung cấp thành công', 'success');
      fetchSuppliers(selectedFarmId);
    } catch (error: any) {
      showToast(error.message || 'Không thể xóa nhà cung cấp', 'error');
    }
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

          {canManageInventory && (
            <button
              onClick={() => handleOpenForm()}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Thêm mới
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase">30 ngày</span>
          </div>
          <p className="text-sm font-semibold text-slate-500">Tổng thức ăn đã dùng</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{formatNumber(consumptionSummary?.totalUsed)} kg</p>
          <p className="text-xs text-slate-400 mt-2">
            Trung bình {formatNumber(consumptionSummary?.averageDailyUsage)} kg/ngày
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase">Cần theo dõi</span>
          </div>
          <p className="text-sm font-semibold text-slate-500">Mặt hàng sắp hết</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{consumptionSummary?.lowStockCount || 0}</p>
          <p className="text-xs text-slate-400 mt-2">So với ngưỡng tối thiểu trong kho</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase">Gần đây</span>
          </div>
          <p className="text-sm font-semibold text-slate-500">Lượt ghi nhận tiêu thụ</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{usageLogs.length}</p>
          <p className="text-xs text-slate-400 mt-2">Hiển thị tối đa 50 nhật ký mới nhất</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Tiêu thụ theo loại thức ăn</h3>
            <Package className="w-5 h-5 text-slate-300" />
          </div>
          <div className="space-y-3">
            {(consumptionSummary?.consumptionByItem || []).length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">Chưa có dữ liệu tiêu thụ trong 30 ngày gần đây.</p>
            ) : (
              consumptionSummary.consumptionByItem.slice(0, 5).map((item: any) => (
                <div key={item.inventoryId} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-sm font-bold text-slate-700 truncate">{item.itemName}</p>
                      <span className="text-sm font-black text-slate-800">{formatNumber(item.quantityUsed)} {item.unit}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, (item.quantityUsed / Math.max(consumptionSummary.totalUsed || 1, item.quantityUsed)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Nhật ký gần đây</h3>
            <CalendarDays className="w-5 h-5 text-slate-300" />
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {usageLogs.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">Chưa có nhật ký tiêu thụ.</p>
            ) : (
              usageLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{log.inventory?.itemName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(log.usageDate)}</p>
                      {log.creator?.fullName && (
                        <p className="text-xs text-slate-500 mt-1">Người ghi nhận: {log.creator.fullName}</p>
                      )}
                    </div>
                    <span className="text-sm font-black text-emerald-600 whitespace-nowrap">
                      {formatNumber(log.quantityUsed)} {log.inventory?.unit}
                    </span>
                  </div>
                  {log.notes && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{log.notes}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {canManageInventory && (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Danh sách nhà cung cấp</h3>
              <p className="text-xs text-slate-500 font-medium">Tổng hợp từ các vật tư đang có trong kho</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl">
              {suppliers.length} nhà cung cấp
            </span>
            <button
              onClick={() => handleOpenSupplierForm()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Thêm
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-sm">
                <th className="px-6 py-4 font-bold text-slate-600">Nhà cung cấp</th>
                <th className="px-6 py-4 font-bold text-slate-600">Số mặt hàng</th>
                <th className="px-6 py-4 font-bold text-slate-600">Nhóm vật tư</th>
                <th className="px-6 py-4 font-bold text-slate-600">Sắp hết</th>
                <th className="px-6 py-4 font-bold text-slate-600">Cập nhật gần nhất</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Truck className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">Chưa có nhà cung cấp nào trong kho.</p>
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr key={supplier.name} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{supplier.name}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {supplier.items?.slice(0, 3).map((item: any) => item.itemName).join(', ')}
                        {supplier.items?.length > 3 ? '...' : ''}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-black text-slate-800">{supplier.itemCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {supplier.categories.map((category: string) => {
                          const cat = getCategoryDetails(category);
                          return (
                            <span key={category} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cat.bg} ${cat.color} ${cat.border}`}>
                              {cat.icon}
                              {cat.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {supplier.lowStockCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {supplier.lowStockCount} mặt hàng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ổn định
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600">{formatDate(supplier.latestUpdatedAt)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenSupplierForm(supplier)}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                          title="Sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(supplier)}
                          className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Grid Cards for Inventory List */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">Đang tải dữ liệu kho...</p>
          </div>
        ) : inventories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Không tìm thấy vật tư nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {inventories.map((item) => {
              const cat = getCategoryDetails(item.category);
              const isLowStock = item.quantity <= item.minThreshold;

              return (
                <div 
                  key={item.id} 
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group relative flex flex-col hover:-translate-y-1 cursor-pointer"
                  onClick={() => setSelectedDetailsItem(item)}
                >
                  {/* Image Section */}
                  <div className="relative w-full h-56 bg-slate-100 overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-contain" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${cat.bg}`}>
                        {item.category === 'FEED' && <Package className={`w-24 h-24 ${cat.color} opacity-40`} />}
                        {item.category === 'MEDICINE' && <Pill className={`w-24 h-24 ${cat.color} opacity-40`} />}
                        {item.category === 'CHEMICAL' && <FlaskConical className={`w-24 h-24 ${cat.color} opacity-40`} />}
                        {!['FEED', 'MEDICINE', 'CHEMICAL'].includes(item.category) && <Box className={`w-24 h-24 ${cat.color} opacity-40`} />}
                      </div>
                    )}
                    
                    {/* Category Badge overlay on image */}
                    <div className="absolute top-3 left-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-white/95 backdrop-blur-sm shadow-sm ${cat.color} ${cat.border}`}>
                        {cat.icon}
                        {cat.label}
                      </span>
                    </div>

                    {/* Actions overlay on image (visible on hover) */}
                    {canManageInventory && (
                      <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenForm(item);
                          }}
                          className="p-2.5 text-blue-600 bg-white/95 backdrop-blur-sm hover:bg-blue-50 hover:text-blue-700 rounded-xl shadow-sm transition-colors border border-blue-100"
                          title="Sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(item);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2.5 text-rose-600 bg-white/95 backdrop-blur-sm hover:bg-rose-50 hover:text-rose-700 rounded-xl shadow-sm transition-colors border border-rose-100"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Info Section */}
                  <div className="p-4 flex flex-col flex-1 bg-white">
                    <div className="mb-3">
                      <h3 className="font-bold text-slate-800 text-lg leading-tight line-clamp-2" title={item.itemName}>{item.itemName}</h3>
                      {item.description && (
                        <p className="text-sm text-slate-500 mt-2 line-clamp-2" title={item.description}>{item.description}</p>
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-end gap-4">
                      {/* Stock Info */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tồn kho</span>
                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                              <AlertCircle className="w-3 h-3" />
                              Sắp hết
                            </span>
                          )}
                        </div>
                        
                        {item.packageType && item.packageQty != null ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-baseline gap-1.5">
                              <span className={`text-2xl font-black ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                                {item.packageQty}
                              </span>
                              <span className="text-sm font-semibold text-slate-600">{item.packageType}</span>
                            </div>
                            <span className="text-xs text-slate-500 font-medium bg-white px-2.5 py-1 rounded-lg border border-slate-200 self-start">
                              Tổng: {item.quantity} {item.unit}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className={`text-2xl font-black ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                              {item.quantity}
                            </span>
                            <span className="text-sm font-semibold text-slate-600">{item.unit}</span>
                          </div>
                        )}
                      </div>

                      {/* Supplier */}
                      <div className="flex items-center gap-2.5 text-sm bg-white border border-slate-100 p-2.5 rounded-xl">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                          <Truck className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Nhà cung cấp</p>
                          <p className="text-slate-700 font-semibold truncate" title={item.supplier?.name || 'Chưa có thông tin'}>
                            {item.supplier?.name || 'Không xác định'}
                          </p>
                        </div>
                      </div>

                      {/* Action Button for Usage (FEED only) */}
                      {item.category === 'FEED' && canRecordUsage && (
                        <button
                          onClick={() => handleOpenUsageForm(item)}
                          className="w-full mt-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-sm group/btn"
                        >
                          <MinusCircle className="w-4 h-4 group-hover/btn:-translate-y-0.5 transition-transform" />
                          Ghi nhận tiêu thụ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
          fetchSuppliers(selectedFarmId);
        }}
      />

      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {editingSupplier ? 'Cập nhật nhà cung cấp' : 'Thêm nhà cung cấp'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">Lưu thông tin nhà cung cấp thường xuyên của trang trại</p>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tên nhà cung cấp <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại</label>
                  <input
                    type="text"
                    inputMode="tel"
                    maxLength={10}
                    pattern="0[0-9]{9}"
                    value={supplierForm.phone}
                    onChange={(e) => {
                      const phone = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setSupplierForm({ ...supplierForm, phone });
                      setSupplierErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    aria-invalid={Boolean(supplierErrors.phone)}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-4 outline-none text-sm font-medium ${
                      supplierErrors.phone
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                        : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'
                    }`}
                  />
                  {supplierErrors.phone && (
                    <p className="mt-2 text-xs font-medium text-red-600">{supplierErrors.phone}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => {
                      setSupplierForm({ ...supplierForm, email: e.target.value });
                      setSupplierErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    aria-invalid={Boolean(supplierErrors.email)}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-4 outline-none text-sm font-medium ${
                      supplierErrors.email
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                        : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'
                    }`}
                  />
                  {supplierErrors.email && (
                    <p className="mt-2 text-xs font-medium text-red-600">{supplierErrors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Địa chỉ</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Ghi chú</label>
                <textarea
                  rows={3}
                  value={supplierForm.note}
                  onChange={(e) => setSupplierForm({ ...supplierForm, note: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-medium resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center"
                >
                  {isSavingSupplier ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Lưu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {usageItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Ghi nhận tiêu thụ thức ăn</h3>
              <p className="text-sm text-slate-500 mt-1">
                {usageItem.itemName} - tồn kho {formatNumber(usageItem.quantity)} {usageItem.unit}
              </p>
            </div>
            <form onSubmit={handleRecordUsage} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Số lượng đã dùng ({usageItem.unit})</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={usageForm.quantityUsed}
                  onChange={(e) => setUsageForm({ ...usageForm, quantityUsed: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-sm font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Ngày sử dụng</label>
                <input
                  type="date"
                  value={usageForm.usageDate}
                  onChange={(e) => setUsageForm({ ...usageForm, usageDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-sm font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Ghi chú</label>
                <textarea
                  value={usageForm.notes}
                  onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-sm font-medium resize-none"
                  placeholder="Ví dụ: Cho ăn ao A1 buổi sáng"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUsageItem(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isRecordingUsage}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center"
                >
                  {isRecordingUsage ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Lưu nhật ký'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Details Modal */}
      <InventoryDetailsModal 
        isOpen={!!selectedDetailsItem}
        item={selectedDetailsItem}
        onClose={() => setSelectedDetailsItem(null)}
      />
    </div>
  );
}
