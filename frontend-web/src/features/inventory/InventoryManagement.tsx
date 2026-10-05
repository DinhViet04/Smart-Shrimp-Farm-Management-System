import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertCircle, CheckCircle2, FlaskConical, Pill, Box, TrendingDown, CalendarDays, Truck, X, ArrowRight, ShieldCheck, AlertTriangle, CircleDollarSign } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { supplierService } from '../../services/supplier.service';
import { pondService } from '../../services/pond.service';
import InventoryFormModal from './InventoryFormModal';
import InventoryDetailsModal from './InventoryDetailsModal';
import InventoryActionModal from './InventoryActionModal';
import InventoryUsageHistoryView from './InventoryUsageHistoryView';
import LoadingMotion from '../../components/LoadingMotion';
import { feedingLogService, type DailyFeedingGroup } from '../../services/feeding-log.service';

const SUPPLIER_PHONE_REGEX = /^0\d{9}$/;
const SUPPLIER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatVND = (val: number | string) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
};


export default function InventoryManagement() {
  const [currentView, setCurrentView] = useState<'main' | 'usage-history'>('main');
  const [consumptionCategory, setConsumptionCategory] = useState<'FEED' | 'MEDICINE' | 'CHEMICAL'>('FEED');
  const [inventories, setInventories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productCategoryFilter, setProductCategoryFilter] = useState<'ALL' | 'FEED' | 'MEDICINE' | 'CHEMICAL'>('ALL');
  const [productSearch, setProductSearch] = useState('');
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [consumptionSummary, setConsumptionSummary] = useState<any>(null);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [recentFeedingLogs, setRecentFeedingLogs] = useState<DailyFeedingGroup[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<any>(null);
  
  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ponds, setPonds] = useState<any[]>([]);
  const [actionItem, setActionItem] = useState<any>(null);
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
  const canRecordUsage = ['FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN'].includes(user.role || '');
  const isFarmerOrTech = ['FARMER', 'TECHNICIAN'].includes(user.role || '');

  const lowStockCount = useMemo(() => {
    return inventories.filter((i) => (i.quantity || 0) <= (i.minThreshold || 0)).length;
  }, [inventories]);

  const fetchInventories = async (farmId: string) => {
    if (!farmId) return;
    try {
      const data = await inventoryService.getAll('', 'ALL', farmId);
      setInventories(data.data || []);
    } catch (error) {
      showToast('Không thể tải danh sách sản phẩm', 'error');
    }
  };

  const fetchConsumptionData = async (
    farmId: string,
    category: 'FEED' | 'MEDICINE' | 'CHEMICAL' = consumptionCategory,
  ) => {
    if (!farmId) return;
    try {
      const [summary, logs, feedingRes] = await Promise.all([
        inventoryService.getConsumptionSummary(farmId, undefined, category),
        inventoryService.getUsageLogs(farmId),
        feedingLogService.getAllGrouped({ farmId, size: 5 }).catch(() => ({ data: [] })),
      ]);
      setConsumptionSummary(summary);
      setUsageLogs(logs || []);
      setRecentFeedingLogs(feedingRes?.data || []);
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

  const loadAllFarmData = async (farmId: string, category: 'FEED' | 'MEDICINE' | 'CHEMICAL' = consumptionCategory) => {
    if (!farmId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      await Promise.allSettled([
        fetchInventories(farmId),
        fetchConsumptionData(farmId, category),
        fetchSuppliers(farmId),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOverview = async () => {
    try {
      const overview = await pondService.getOverview();
      setFarms(overview.farms);
      setPonds(overview.ponds);
      if (overview.farms.length > 0 && !selectedFarmId) {
        setSelectedFarmId(overview.farms[0].id);
      } else if (!overview.farms.length) {
        setIsLoading(false);
      }
    } catch (error) {
      showToast('Không thể tải dữ liệu trang trại và ao nuôi', 'error');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (selectedFarmId) {
      loadAllFarmData(selectedFarmId, consumptionCategory);
    }
  }, [selectedFarmId]);

  useEffect(() => {
    if (selectedFarmId) {
      fetchConsumptionData(selectedFarmId, consumptionCategory);
    }
  }, [consumptionCategory]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await inventoryService.remove(itemToDelete.id);
      showToast('Xóa sản phẩm thành công!', 'success');
      fetchInventories(selectedFarmId);
    } catch (error: any) {
      showToast(error.message || 'Không thể xóa sản phẩm này', 'error');
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

  const handleOpenActionModal = (item: any) => {
    setActionItem(item);
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

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  // Thống kê phân loại vật tư
  const feedCount = useMemo(() => inventories.filter((i) => i.category === 'FEED').length, [inventories]);
  const medCount = useMemo(() => inventories.filter((i) => i.category === 'MEDICINE').length, [inventories]);
  const chemCount = useMemo(() => inventories.filter((i) => i.category === 'CHEMICAL').length, [inventories]);

  // Danh sách sản phẩm được lọc theo danh mục và tìm kiếm trong Khung "Danh sách sản phẩm"
  const filteredProducts = useMemo(() => {
    return inventories.filter((item) => {
      // 1. Lọc theo danh mục
      if (productCategoryFilter !== 'ALL' && item.category !== productCategoryFilter) {
        return false;
      }
      // 2. Lọc theo từ khóa tìm kiếm (tên vật tư, mô tả, nhà cung cấp)
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase().trim();
        const name = (item.itemName || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const supplierName = (item.supplier?.name || '').toLowerCase();
        if (!name.includes(q) && !desc.includes(q) && !supplierName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [inventories, productCategoryFilter, productSearch]);

  // Danh sách toàn bộ sản phẩm theo danh mục đang chọn kèm tiến độ tiêu thụ & tồn kho
  const categoryProductsWithUsage = useMemo(() => {
    const currentCategoryItems = inventories.filter(
      (item) => item.category === consumptionCategory
    );

    return currentCategoryItems.map((item) => {
      const consumed = consumptionSummary?.consumptionByItem?.find(
        (c: any) => c.inventoryId === item.id
      );
      const quantityUsed = consumed ? consumed.quantityUsed : 0;
      const quantityRemaining = item.quantity || 0;
      const minThreshold = item.minThreshold || 0;
      const total = quantityRemaining + quantityUsed;

      const effectiveTotal = total > 0 ? total : Math.max(minThreshold, 1);
      const usedPercent = Math.min(100, Math.max(0, Math.round((quantityUsed / effectiveTotal) * 100)));
      const remainPercent = total > 0 ? 100 - usedPercent : 0;

      // Phân loại trạng thái số lượng còn lại:
      // - Đỏ (CRITICAL): Cảnh báo khi chạm hoặc dưới ngưỡng tối thiểu (hoặc hết hàng)
      // - Vàng cam (LOW): Sắp hết khi tồn kho gần ngưỡng (<= 1.5 lần ngưỡng tối thiểu)
      // - Xanh lá (SAFE): Còn dồi dào, an toàn (> 1.5 lần ngưỡng tối thiểu)
      let status: 'SAFE' | 'LOW' | 'CRITICAL' = 'SAFE';
      if (quantityRemaining <= minThreshold || quantityRemaining === 0) {
        status = 'CRITICAL';
      } else if (quantityRemaining <= minThreshold * 1.5) {
        status = 'LOW';
      } else {
        status = 'SAFE';
      }

      return {
        item,
        quantityUsed,
        quantityRemaining,
        minThreshold,
        total,
        usedPercent,
        remainPercent,
        status,
      };
    });
  }, [inventories, consumptionCategory, consumptionSummary]);

  const lowStockCountForCategory = useMemo(() => {
    return categoryProductsWithUsage.filter((p) => p.status === 'CRITICAL' || p.status === 'LOW').length;
  }, [categoryProductsWithUsage]);

  // Tổng hợp hoạt động sử dụng gần nhất (cả Cho ăn hàng ngày và Xuất kho)
  const recentActivities = useMemo(() => {
    const list: any[] = [];

    // 1. Thêm các đợt cho ăn gần đây
    recentFeedingLogs.forEach((fg) => {
      list.push({
        id: `feeding_${fg.id}`,
        isFeeding: true,
        date: fg.feedingDate,
        title: `Cho ăn ${fg.pondName}`,
        category: 'FEED',
        amount: fg.totalFeedKg,
        unit: 'kg',
        creator: fg.createdBy || 'Nông dân',
        sessionsSummary: `${fg.completedSessions}/7 cữ xong`,
        note: (fg.sessions || [])
          .filter((s) => s.feedingStatus !== 'SKIPPED' && s.feedProductName)
          .map((s) => s.feedProductName)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ') || 'Cho ăn theo cữ hàng ngày',
      });
    });

    // 2. Thêm các đợt biến động kho (Nhập kho / Xuất kho)
    usageLogs.forEach((ul) => {
      const isImport = ul.type === 'IMPORT' || ul.notes?.startsWith('[NHẬP KHO') || false;
      list.push({
        id: `usage_${ul.id}`,
        isFeeding: false,
        isImport,
        date: ul.usageDate,
        title: ul.inventory?.itemName || 'Vật tư',
        category: ul.inventory?.category || 'FEED',
        amount: ul.quantityUsed,
        unit: ul.inventory?.unit || 'kg',
        creator: ul.creator?.fullName || 'Hệ thống',
        sessionsSummary: null,
        note: ul.notes,
      });
    });

    // Sắp xếp giảm dần theo ngày
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [recentFeedingLogs, usageLogs]);

  // Chuyển trang riêng sang Nhật ký sử dụng chi tiết khi được bấm
  if (currentView === 'usage-history') {
    return (
      <InventoryUsageHistoryView
        farmId={selectedFarmId}
        farmName={selectedFarm?.name}
        ponds={ponds}
        onBack={() => setCurrentView('main')}
      />
    );
  }

  // Motion hiệu ứng khi dữ liệu đang tải
  if (isLoading && (!consumptionSummary || inventories.length === 0)) {
    return (
      <LoadingMotion
        title="Đang tải dữ liệu Kho sản phẩm..."
        subtitle="Hệ thống đang đồng bộ danh mục sản phẩm, biến động nhập xuất và tiến độ tiêu thụ từ trang trại..."
        icon={<Package className="w-11 h-11 text-blue-600 animate-pulse" />}
        headerTitle="Kho Sản phẩm & Thức ăn"
        headerSubtitle="Quản lý các loại thức ăn, thuốc, hóa chất"
        headerIcon={<Package className="w-7 h-7 text-blue-600" />}
        color="blue"
      />
    );
  }

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
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight">Kho Sản phẩm & Thức ăn</h2>
            <p className="text-sm text-slate-500 font-medium">Quản lý các loại thức ăn, thuốc, hóa chất</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
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

      {/* Thống kê hàng đầu */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">Toàn thời gian</span>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng xuất dùng</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{formatNumber(consumptionSummary?.totalUsed)} <span className="text-base font-semibold text-slate-500">kg/lít</span></p>
          <p className="text-xs text-slate-400 mt-2 font-medium">
            {consumptionSummary?.totalUsed > 0 ? 'Tổng lượng đã xuất dùng cho các ao nuôi' : 'Chưa phát sinh xuất dùng'}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
              {inventories.length} mặt hàng
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng sản phẩm trong kho</p>
          <p className="text-3xl font-black text-blue-700 mt-1">{inventories.length} <span className="text-base font-semibold text-slate-500">sản phẩm</span></p>
          <p className="text-xs text-slate-400 mt-2 font-medium">
            {feedCount} thức ăn • {medCount} thuốc • {chemCount} hóa chất
          </p>
        </div>

        {isFarmerOrTech ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
                lowStockCount > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
              }`}>
                {lowStockCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${
                lowStockCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
              }`}>
                {lowStockCount > 0 ? `${lowStockCount} cần lưu ý` : 'Ổn định'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tình trạng tồn kho</p>
            <p className={`text-3xl font-black mt-1 ${lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {lowStockCount > 0 ? `${lowStockCount} mặt hàng` : '100% An toàn'}
            </p>
            <p className="text-xs text-slate-400 mt-2 font-medium">
              {lowStockCount > 0 ? 'Có sản phẩm đã chạm hoặc dưới ngưỡng cảnh báo' : 'Tất cả sản phẩm đều trên ngưỡng an toàn'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <Truck className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                {suppliers.length} đối tác
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nhà cung cấp đối tác</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{suppliers.length} <span className="text-base font-semibold text-slate-500">nhà cung cấp</span></p>
            <p className="text-xs text-slate-400 mt-2 font-medium">
              Liên kết trực tiếp với các nguồn sản phẩm
            </p>
          </div>
        )}
      </div>

      {/* Sản phẩm tiêu thụ & Nhật ký sử dụng */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Cột 1: Sản phẩm tiêu thụ (Chiếm 2 cột trên màn hình rộng) */}
        <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header của Sản phẩm tiêu thụ với Tabs chọn Danh mục */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-800">Sản phẩm tiêu thụ</h3>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                      {categoryProductsWithUsage.length} mặt hàng
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Theo dõi tỷ lệ xuất dùng so với số lượng còn trong kho
                  </p>
                </div>
              </div>

              {/* Tabs chọn danh mục: Thức ăn / Thuốc / Hóa chất */}
              <div className="inline-flex p-1 bg-slate-100 rounded-2xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setConsumptionCategory('FEED')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    consumptionCategory === 'FEED'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Thức ăn
                </button>
                <button
                  type="button"
                  onClick={() => setConsumptionCategory('MEDICINE')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    consumptionCategory === 'MEDICINE'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  Thuốc
                </button>
                <button
                  type="button"
                  onClick={() => setConsumptionCategory('CHEMICAL')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    consumptionCategory === 'CHEMICAL'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  Hóa chất
                </button>
              </div>
            </div>

            {/* Chú thích màu sắc */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 px-3 bg-slate-50/80 rounded-2xl my-3 text-[11px] font-bold text-slate-600 border border-slate-100">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Chú thích màu:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                <span>Số lượng đã dùng</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span>Số lượng còn lại</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                <span>Gần hết</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span>Cảnh báo</span>
              </div>

              {lowStockCountForCategory > 0 && (
                <span className="ml-auto text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {lowStockCountForCategory} mặt hàng cần lưu ý
                </span>
              )}
            </div>

            {/* Danh sách toàn bộ sản phẩm của danh mục được chọn */}
            <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
              {categoryProductsWithUsage.length === 0 ? (
                <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">
                    Chưa có sản phẩm {consumptionCategory === 'FEED' ? 'thức ăn' : consumptionCategory === 'MEDICINE' ? 'thuốc' : 'hóa chất'} nào trong kho
                  </p>
                  {canManageInventory && (
                    <button
                      onClick={() => handleOpenForm()}
                      className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm sản phẩm mới
                    </button>
                  )}
                </div>
              ) : (
                categoryProductsWithUsage.map(({ item, quantityUsed, quantityRemaining, minThreshold, total, usedPercent, remainPercent, status }) => {
                  const remainColor = status === 'CRITICAL' ? 'bg-rose-500' : status === 'LOW' ? 'bg-amber-400' : 'bg-emerald-500';
                  const remainTextColor = status === 'CRITICAL' ? 'text-rose-700' : status === 'LOW' ? 'text-amber-700' : 'text-emerald-700';
                  const remainBadgeBg = status === 'CRITICAL' ? 'bg-rose-50 border-rose-200' : status === 'LOW' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50/60 transition-all duration-200 group"
                      onClick={() => setSelectedDetailsItem(item)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                        {/* Tên vật tư + Trạng thái */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-800 text-sm truncate group-hover:text-blue-600 transition-colors">
                            {item.itemName}
                          </span>

                          {status === 'CRITICAL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              {quantityRemaining === 0 ? 'Hết hàng' : 'Cảnh báo chạm ngưỡng'}
                            </span>
                          )}

                          {status === 'LOW' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              Sắp hết
                            </span>
                          )}

                          {status === 'SAFE' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Ổn định
                            </span>
                          )}
                        </div>

                        {/* Số liệu: Đã dùng - Còn lại - Tổng */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold shrink-0">
                          <span className="text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                            Đã dùng: {formatNumber(quantityUsed)} {item.unit}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md border ${remainTextColor} ${remainBadgeBg}`}>
                            Còn lại: {formatNumber(quantityRemaining)} {item.unit}
                          </span>
                          <span className="text-slate-400 font-semibold text-[11px]">
                            (Tổng: {formatNumber(total)} {item.unit})
                          </span>
                        </div>
                      </div>

                      {/* Thanh hiển thị đa màu: Xanh dương (đã dùng) & Xanh lá / Vàng / Đỏ (còn lại) */}
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        {usedPercent > 0 && (
                          <div
                            className="h-full bg-blue-600 transition-all duration-500"
                            style={{ width: `${usedPercent}%` }}
                            title={`Đã dùng: ${formatNumber(quantityUsed)} ${item.unit} (${usedPercent}%)`}
                          />
                        )}
                        {remainPercent > 0 && (
                          <div
                            className={`h-full ${remainColor} transition-all duration-500`}
                            style={{ width: `${remainPercent}%` }}
                            title={`Còn lại: ${formatNumber(quantityRemaining)} ${item.unit} (${remainPercent}%)`}
                          />
                        )}
                        {total === 0 && (
                          <div className="h-full w-full bg-slate-200 text-center text-[9px] text-slate-500 leading-3">
                            Chưa có dữ liệu
                          </div>
                        )}
                      </div>

                      {/* Thông tin ngưỡng và phần trăm */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-0.5 font-medium">
                        <span>
                          Ngưỡng tối thiểu: <span className="font-bold text-slate-600">{formatNumber(minThreshold)} {item.unit}</span>
                        </span>
                        <span>
                          {usedPercent}% đã dùng • {remainPercent}% còn lại
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Cột 2: Nhật ký sử dụng (Giao diện thẻ ngoài, hiển thị cứng 3-4 lượt gần nhất) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Nhật ký sử dụng</h3>
                  <p className="text-xs text-slate-400 font-medium">Hoạt động xuất dùng gần nhất</p>
                </div>
              </div>

              <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-xl">
                {recentActivities.length} hoạt động
              </span>
            </div>

            {/* Hiển thị cứng 3 - 4 lượt sử dụng gần nhất */}
            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Chưa có nhật ký sử dụng nào.</p>
                </div>
              ) : (
                recentActivities.slice(0, 4).map((activity) => {
                  const cat = getCategoryDetails(activity.category);
                  return (
                    <div
                      key={activity.id}
                      className="border border-slate-100 rounded-2xl p-3.5 hover:bg-slate-50/70 hover:border-blue-100 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`inline-flex items-center p-1 rounded-md text-[10px] ${cat.bg} ${cat.color}`}>
                              {cat.icon}
                            </span>
                            <p className="text-sm font-bold text-slate-800 truncate">{activity.title}</p>
                            {activity.isFeeding ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                                🦐 Cho ăn ({activity.sessionsSummary})
                              </span>
                            ) : activity.isImport ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                                📥 Nhập kho
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
                                📤 Xuất kho
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{formatDate(activity.date)}</p>
                          {activity.creator && (
                            <p className="text-xs text-slate-500 mt-1 font-medium">
                              Người ghi nhận: <span className="font-bold text-slate-700">{activity.creator}</span>
                            </p>
                          )}
                        </div>
                        {activity.isImport ? (
                          <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl whitespace-nowrap shadow-sm">
                            + {formatNumber(activity.amount)} {activity.unit}
                          </span>
                        ) : (
                          <span className="text-xs font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl whitespace-nowrap shadow-sm">
                            - {formatNumber(activity.amount)} {activity.unit}
                          </span>
                        )}
                      </div>
                      {activity.note && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          {activity.note}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Nút bấm chuyển sang trang riêng xem toàn bộ Nhật ký biến động & Sử dụng */}
          <button
            type="button"
            onClick={() => setCurrentView('usage-history')}
            className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            <span>Xem chi tiết Nhật ký</span>
            <ArrowRight className="w-4 h-4" />
          </button>
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
              <h3 className="text-lg font-black text-slate-800">Danh sách nhà cung cấp</h3> 
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
                <th className="px-6 py-4 font-bold text-slate-600">Nhóm sản phẩm</th>
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

      {/* Khung: Danh sách sản phẩm */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        {/* Header của Khung Danh sách sản phẩm */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-black text-slate-800">Danh sách sản phẩm</h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {filteredProducts.length} mặt hàng
                </span>
              </div>
            </div>
          </div>

          {/* Bộ lọc Danh mục & Thanh tìm kiếm vật tư */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Tabs chọn danh mục */}
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl self-start sm:self-auto flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setProductCategoryFilter('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  productCategoryFilter === 'ALL'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tất cả ({inventories.length})
              </button>
              <button
                type="button"
                onClick={() => setProductCategoryFilter('FEED')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  productCategoryFilter === 'FEED'
                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                    : 'text-slate-600 hover:text-amber-600 hover:bg-amber-50/50'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Thức ăn ({feedCount})
              </button>
              <button
                type="button"
                onClick={() => setProductCategoryFilter('MEDICINE')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  productCategoryFilter === 'MEDICINE'
                    ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20'
                    : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50/50'
                }`}
              >
                <Pill className="w-3.5 h-3.5" />
                Thuốc ({medCount})
              </button>
              <button
                type="button"
                onClick={() => setProductCategoryFilter('CHEMICAL')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  productCategoryFilter === 'CHEMICAL'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/20'
                    : 'text-slate-600 hover:text-cyan-600 hover:bg-cyan-50/50'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Hóa chất ({chemCount})
              </button>
            </div>

            {/* Thanh tìm kiếm theo tên sản phẩm */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên sản phẩm..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-inner"
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Nội dung bên trong khung: Grid thẻ sản phẩm */}
        <div className="p-5 sm:p-6 bg-slate-50/30">
          {isLoading ? (
            <LoadingMotion
              mode="card"
              title="Đang làm mới danh mục sản phẩm kho..."
              subtitle="Đang tải danh sách theo bộ lọc và từ khóa tìm kiếm..."
              icon={<Package className="w-10 h-10 text-blue-600 animate-pulse" />}
              color="blue"
            />
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed text-center px-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 text-slate-300">
                <Package className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-700">Không tìm thấy sản phẩm nào</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Không có sản phẩm nào khớp với danh mục hoặc từ khóa tìm kiếm của bạn.
              </p>
              {(productCategoryFilter !== 'ALL' || productSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setProductCategoryFilter('ALL');
                    setProductSearch('');
                  }}
                  className="mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((item) => {
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
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-white/95 backdrop-blur-sm shadow-sm ${cat.color} ${cat.border}`}>
                        {cat.icon}
                        {cat.label}
                      </span>
                      {isLowStock && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500 text-white shadow-sm animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Sắp hết
                        </span>
                      )}
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
                      {/* Specification & Price Section (Replaces 20 chai tổng 20 lít & Nhà cung cấp) */}
                      <div className="bg-slate-50/80 rounded-2xl border border-slate-100 p-3.5 flex flex-col gap-2.5">
                        {/* 1. Quy cách (Bao nhiêu Lít/Chai hoặc kg/Bao) */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-slate-400" />
                            Quy cách
                          </span>
                          <span className="text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                            {item.weightPerPkg && item.packageType
                              ? `${item.weightPerPkg} ${item.unit} / ${item.packageType}`
                              : `${item.unit}`}
                          </span>
                        </div>

                        {/* 2. Đơn giá sản phẩm (Ẩn với Kỹ thuật viên & Nông dân) */}
                        {!isFarmerOrTech && (
                          <div className="pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                              <CircleDollarSign className="w-3.5 h-3.5 text-emerald-600" />
                              Đơn giá
                            </span>
                            <div className="text-right">
                              {item.pricePerPackage && item.pricePerPackage > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 shadow-2xs">
                                  <span className="text-sm font-black tracking-tight">
                                    {formatVND(item.pricePerPackage)}
                                  </span>
                                  <span className="text-[10.5px] font-bold text-emerald-600/90">
                                    đ / {item.packageType || 'đơn vị'}
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[11px] font-semibold text-slate-400 italic bg-white px-2.5 py-1 rounded-lg border border-slate-200/70 shadow-2xs">
                                  Chưa có giá
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Button for Usage (ALL categories) */}
                      {canRecordUsage && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenActionModal(item);
                          }}
                          className="w-full mt-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-sm group/btn"
                        >
                          <Package className="w-4 h-4 group-hover/btn:-translate-y-0.5 transition-transform" />
                          Nhập kho / Xuất kho
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

      <InventoryActionModal
        isOpen={!!actionItem}
        item={actionItem}
        ponds={ponds}
        selectedFarmId={selectedFarmId}
        onClose={() => setActionItem(null)}
        onSuccess={(msg) => {
          showToast(msg, 'success');
          fetchInventories(selectedFarmId);
          fetchConsumptionData(selectedFarmId);
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
              Bạn có chắc chắn muốn xóa sản phẩm <span className="font-semibold text-slate-700">{itemToDelete?.itemName}</span>? 
              Hệ thống sẽ không cho phép xóa nếu sản phẩm này đã có nhật ký sử dụng.
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
        canViewSupplier={!isFarmerOrTech}
        canViewPrice={!isFarmerOrTech}
        onClose={() => setSelectedDetailsItem(null)}
      />
    </div>
  );
}
