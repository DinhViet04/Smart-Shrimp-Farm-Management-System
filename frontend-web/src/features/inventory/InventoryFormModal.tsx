import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import {
  X,
  Save,
  AlertCircle,
  Package,
  Pill,
  FlaskConical,
  ChevronLeft,
  Lock,
  Truck,
  AlertTriangle,
  Image as ImageIcon,
  FileText,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  Box,
  CircleDollarSign,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { supplierService } from '../../services/supplier.service';

const formatVND = (val: number | string) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
};

const sanitizeNumericInput = (val: string): string => {
  if (!val) return '';
  // Allow decimals like '0.' or '0.5'
  if (val.startsWith('0.') || val.startsWith('.')) return val;
  if (val === '0') return '0';
  // Strip leading zeros before any digits: e.g. "020" -> "20", "0100000" -> "100000"
  return val.replace(/^0+(?=\d)/, '');
};

interface InventoryFormModalProps {
  isOpen: boolean;
  initialData?: any;
  selectedFarmId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface FormDataState {
  itemName: string;
  category: string;
  packageType: string;
  packageQty: number | string;
  weightPerPkg: number | string;
  quantity: number | string;
  unit: string;
  minThreshold: number | string;
  pricePerPackage: number | string;
  supplierId: string;
  description: string;
  imageUrl: string;
  shape: string;
  sizeSpec: string;
}

interface PricingSectionProps {
  isEditMode: boolean;
  formData: FormDataState;
  error?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

function PricingSection({
  isEditMode,
  formData,
  error,
  onChange,
}: PricingSectionProps) {
  const rawQty = Number(formData.packageQty) || 0;
  const pkgQty = rawQty % 1 === 0 ? rawQty : Math.round(rawQty * 100) / 100;
  const unitPrice = Number(formData.pricePerPackage) || 0;
  const weightPerPkg = Number(formData.weightPerPkg) || 0;
  const totalValue = pkgQty * unitPrice;
  const packageLabel = formData.packageType || 'đơn vị';

  return (
    <div
      className={`rounded-2xl border transition-all ${
        error
          ? 'border-red-300 bg-red-50/30 ring-2 ring-red-500/10'
          : 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/60 via-slate-50/40 to-teal-50/30 hover:border-emerald-300 shadow-xs'
      } p-4 sm:p-5`}
    >
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-emerald-100/90">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
            <CircleDollarSign className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Đơn giá theo {packageLabel}
              </h4>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/60">
                VNĐ / {packageLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Căn cứ để tính tổng chi phí theo từng ao / vụ nuôi khi xuất kho
            </p>
          </div>
        </div>
      </div>

      {/* 2 Columns: Left Input - Right Calculation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        {/* Left Column: Đơn giá input card */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-emerald-100/90 flex flex-col justify-between shadow-2xs">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Đơn giá 1 {packageLabel} <span className="text-slate-400 font-normal">(VNĐ)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                name="pricePerPackage"
                min="0"
                step="1000"
                value={formData.pricePerPackage}
                onChange={onChange}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.select();
                }}
                placeholder="0"
                className={`w-full pl-3.5 pr-14 py-2.5 bg-slate-50/50 border rounded-xl text-base font-black text-slate-800 outline-none transition-all ${
                  error
                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                    : 'border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10'
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200/80">
                VNĐ
              </span>
            </div>
            {error && (
              <p className="mt-1.5 text-[11px] text-red-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          {/* Formatted live readout */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Giá hiển thị:</span>
              <span className="font-extrabold text-emerald-700">
                {unitPrice > 0 ? `${formatVND(unitPrice)} đ` : '0 đ'}{' '}
                <span className="text-slate-500 font-medium">/ {packageLabel}</span>
              </span>
            </div>
            {weightPerPkg > 0 && unitPrice > 0 && (
              <div className="flex items-center justify-between text-slate-400 text-[10.5px]">
                <span>Quy đổi theo {formData.unit}:</span>
                <span className="font-semibold text-slate-600">
                  ~ {formatVND(unitPrice / weightPerPkg)} đ / {formData.unit}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tổng giá trị card */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-emerald-100/90 flex flex-col justify-between shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-100/40 via-emerald-50/20 to-transparent rounded-bl-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isEditMode ? 'Tổng giá trị' : 'Tổng giá trị hàng khởi tạo'}
              </span>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                {pkgQty} {packageLabel}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 my-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
                {formatVND(totalValue)}
              </span>
              <span className="text-sm font-black text-emerald-600">VNĐ</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-dashed border-emerald-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px] font-medium">Chi tiết tính:</span>
            <span className="font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80 text-[11px] font-mono">
              {pkgQty} {packageLabel} × {formatVND(unitPrice)} đ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InventoryFormModal({
  isOpen,
  initialData,
  selectedFarmId,
  onClose,
  onSuccess,
}: InventoryFormModalProps) {
  const isEditMode = Boolean(initialData);

  const [formData, setFormData] = useState<FormDataState>({
    itemName: '',
    category: 'FEED',
    packageType: 'Bao',
    packageQty: '',
    weightPerPkg: '',
    quantity: '',
    unit: 'kg',
    minThreshold: '',
    pricePerPackage: '',
    supplierId: '',
    description: '',
    imageUrl: '',
    shape: 'Mảnh',
    sizeSpec: '',
  });

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    minThreshold?: string;
    pricePerPackage?: string;
    imageUrl?: string;
    description?: string;
  }>({});
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        itemName: initialData.itemName || '',
        category: initialData.category || 'FEED',
        packageType: initialData.packageType || 'Bao',
        packageQty: initialData.packageQty != null && initialData.packageQty !== 0 ? initialData.packageQty : (initialData.packageQty === 0 ? 0 : ''),
        weightPerPkg: initialData.weightPerPkg != null && initialData.weightPerPkg !== 0 ? initialData.weightPerPkg : (initialData.weightPerPkg === 0 ? 0 : ''),
        quantity: initialData.quantity != null && initialData.quantity !== 0 ? initialData.quantity : (initialData.quantity === 0 ? 0 : ''),
        unit: initialData.unit || 'kg',
        minThreshold: initialData.minThreshold != null && initialData.minThreshold !== 0 ? initialData.minThreshold : (initialData.minThreshold === 0 ? 0 : ''),
        pricePerPackage: initialData.pricePerPackage != null && initialData.pricePerPackage !== 0 ? initialData.pricePerPackage : (initialData.pricePerPackage === 0 ? 0 : ''),
        supplierId: initialData.supplierId || initialData.supplier?.id || '',
        description: initialData.description || '',
        imageUrl: initialData.imageUrl || '',
        shape: initialData.shape || 'Mảnh',
        sizeSpec: initialData.sizeSpec || '',
      });
      setImageError(false);
      setFieldErrors({});
      setStep(2);
    } else {
      setFormData({
        itemName: '',
        category: 'FEED',
        packageType: 'Bao',
        packageQty: '',
        weightPerPkg: '',
        quantity: '',
        unit: 'kg',
        minThreshold: '',
        pricePerPackage: '',
        supplierId: '',
        description: '',
        imageUrl: '',
        shape: 'Mảnh',
        sizeSpec: '',
      });
      setImageError(false);
      setFieldErrors({});
      setStep(1);
    }
    setError('');
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedFarmId) return;

    const fetchSuppliers = async () => {
      try {
        const data = await supplierService.getAll(selectedFarmId);
        setSuppliers(data || []);
      } catch (err) {
        setSuppliers([]);
      }
    };

    fetchSuppliers();
  }, [isOpen, selectedFarmId]);

  if (!isOpen) return null;

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as any;
    let cleanVal = value;
    if (type === 'number') {
      cleanVal = sanitizeNumericInput(value);
      if (e.target.value !== cleanVal) {
        e.target.value = cleanVal;
      }
    }
    setFormData((prev) => ({
      ...prev,
      [name]: cleanVal,
    }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    if (name === 'imageUrl') {
      setImageError(false);
    }
  };

  const validateEditForm = () => {
    const errors: { minThreshold?: string; pricePerPackage?: string; imageUrl?: string; description?: string } = {};

    // Validate minThreshold
    if (
      formData.minThreshold === '' ||
      formData.minThreshold === undefined ||
      formData.minThreshold === null
    ) {
      errors.minThreshold = 'Vui lòng nhập ngưỡng cảnh báo tối thiểu';
    } else {
      const thresholdNum = Number(formData.minThreshold);
      if (isNaN(thresholdNum)) {
        errors.minThreshold = 'Ngưỡng cảnh báo phải là một số hợp lệ';
      } else if (thresholdNum < 0) {
        errors.minThreshold = 'Ngưỡng cảnh báo tối thiểu không được nhỏ hơn 0';
      } else if (thresholdNum > 10000000) {
        errors.minThreshold = 'Ngưỡng cảnh báo không được vượt quá 10,000,000';
      }
    }

    // Validate pricePerPackage
    if (
      formData.pricePerPackage !== '' &&
      formData.pricePerPackage !== undefined &&
      formData.pricePerPackage !== null
    ) {
      const priceNum = Number(formData.pricePerPackage);
      if (isNaN(priceNum)) {
        errors.pricePerPackage = 'Giá tiền phải là một số hợp lệ';
      } else if (priceNum < 0) {
        errors.pricePerPackage = 'Giá tiền không được nhỏ hơn 0';
      } else if (priceNum > 1000000000) {
        errors.pricePerPackage = 'Giá tiền không được vượt quá 1,000,000,000 VNĐ';
      }
    }

    // Validate imageUrl
    const trimmedUrl = formData.imageUrl?.trim() || '';
    if (trimmedUrl) {
      if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
        errors.imageUrl = 'Đường dẫn hình ảnh không hợp lệ (cần bắt đầu bằng http:// hoặc https://)';
      } else {
        try {
          new URL(trimmedUrl);
        } catch {
          errors.imageUrl = 'Định dạng liên kết hình ảnh không đúng';
        }
      }
    }

    // Validate description
    if (formData.description && formData.description.length > 500) {
      errors.description = `Mô tả không được vượt quá 500 ký tự (hiện có ${formData.description.length} ký tự)`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isEditMode) {
        if (!validateEditForm()) {
          setIsLoading(false);
          return;
        }

        // Gửi các trường được phép cập nhật
        const updatePayload = {
          minThreshold: Number(formData.minThreshold) || 0,
          pricePerPackage: formData.pricePerPackage === '' ? 0 : Number(formData.pricePerPackage) || 0,
          supplierId: formData.supplierId || null,
          description: formData.description?.trim() || '',
          imageUrl: formData.imageUrl?.trim() || '',
          farmId: selectedFarmId,
        };
        await inventoryService.update(initialData.id, updatePayload);
        onSuccess('Cập nhật thông tin sản phẩm thành công!');
      } else {
        if (
          formData.pricePerPackage !== '' &&
          formData.pricePerPackage !== undefined &&
          formData.pricePerPackage !== null
        ) {
          const priceNum = Number(formData.pricePerPackage);
          if (isNaN(priceNum) || priceNum < 0) {
            setError('Đơn giá không hợp lệ hoặc nhỏ hơn 0');
            setIsLoading(false);
            return;
          }
        }

        const createPayload = {
          ...formData,
          minThreshold: Number(formData.minThreshold) || 0,
          packageQty: Number(formData.packageQty) || 0,
          weightPerPkg: Number(formData.weightPerPkg) || 0,
          pricePerPackage: formData.pricePerPackage === '' ? 0 : Number(formData.pricePerPackage) || 0,
          supplierId: formData.supplierId || null,
          farmId: selectedFarmId,
        };
        await inventoryService.create(createPayload);
        onSuccess('Thêm sản phẩm mới thành công!');
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper hiển thị category badge
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'FEED':
        return {
          label: 'Thức ăn',
          icon: <Package className="w-4 h-4 text-amber-600" />,
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
        };
      case 'MEDICINE':
        return {
          label: 'Thuốc / Dược phẩm',
          icon: <Pill className="w-4 h-4 text-rose-600" />,
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
        };
      case 'CHEMICAL':
        return {
          label: 'Hóa chất xử lý',
          icon: <FlaskConical className="w-4 h-4 text-cyan-600" />,
          badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
        };
      default:
        return {
          label: 'Sản phẩm khác',
          icon: <Box className="w-4 h-4 text-slate-600" />,
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const categoryMeta = getCategoryBadge(formData.category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/30">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${
                isEditMode
                  ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-blue-500/20'
                  : 'bg-blue-100 text-blue-600'
              }`}
            >
              {isEditMode ? (
                <SlidersHorizontal className="w-5 h-5" />
              ) : (
                <Package className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                  {isEditMode ? 'Cập nhật thông tin sản phẩm' : 'Thêm sản phẩm mới'}
                </h2>
                {isEditMode && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                    <Lock className="w-3 h-3" /> Chế độ an toàn
                  </span>
                )}
              </div>
              {!isEditMode && (
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  Nhập thông tin chi tiết để thêm mới sản phẩm vào kho
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 animate-in fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm font-semibold">{error}</div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CHẾ ĐỘ 1: CẬP NHẬT VẬT TƯ (EDIT MODE)                     */}
          {/* ======================================================== */}
          {isEditMode ? (
            <form id="inventoryForm" onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Card thông tin vật tư cố định (Read-Only Specs) */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-white to-blue-50/40 p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Thumbnail / Placeholder */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border border-slate-200/80 shadow-inner flex items-center justify-center overflow-hidden shrink-0">
                    {formData.imageUrl && !imageError ? (
                      <img
                        src={formData.imageUrl}
                        alt={formData.itemName}
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                        {categoryMeta.icon}
                        <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                          {formData.category}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Thông tin cố định */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${categoryMeta.badgeClass}`}
                      >
                        {categoryMeta.icon}
                        {categoryMeta.label}
                      </span>
                    </div>

                    <h3
                      className="text-lg sm:text-xl font-black text-slate-900 leading-snug truncate"
                      title={formData.itemName}
                    >
                      {formData.itemName}
                    </h3>

                    {/* Grid specs - Đồng bộ số bao và số kí tương tự bên ngoài card */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
                      <div className="bg-white/90 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Số lượng hiện tại
                        </span>
                        {formData.packageType && formData.packageQty != null ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-baseline gap-1">
                              <span className="text-base sm:text-lg font-black text-slate-800">
                                {Math.ceil(Number(formData.packageQty) || 0)}
                              </span>
                              <span className="text-xs font-semibold text-slate-600">
                                {formData.packageType}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Tổng: {Math.round((Number(formData.quantity) || 0) * 100) / 100}{' '}
                              {formData.unit}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <span className="text-base sm:text-lg font-black text-slate-800">
                              {Math.round((Number(formData.quantity) || 0) * 100) / 100}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              {formData.unit}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="bg-white/90 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Định lượng
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm sm:text-base font-bold text-slate-800">
                            {Math.round((Number(formData.weightPerPkg) || 0) * 100) / 100}{' '}
                            {formData.unit}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            / {formData.packageType}
                          </span>
                        </div>
                      </div>

                      {formData.category === 'FEED' && formData.shape && (
                        <div className="col-span-2 sm:col-span-1 bg-white/90 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Quy cách hạt
                          </span>
                          <span
                            className="text-xs sm:text-sm font-bold text-slate-800 truncate block"
                            title={`${formData.shape} ${
                              formData.sizeSpec ? `(${formData.sizeSpec})` : ''
                            }`}
                          >
                            {formData.shape} {formData.sizeSpec ? `(${formData.sizeSpec})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ghi chú khóa thông tin an toàn */}
                <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>
                    Sử dụng{' '}
                    <strong className="text-emerald-700">Nhập kho / Xuất kho</strong> để thay đổi số lượng sản phẩm trong kho.
                  </span>
                </div>
              </div>

              {/* Form 4 trường ĐƯỢC PHÉP CHỈNH SỬA */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Các thông tin cho phép chỉnh sửa
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* 1. Ngưỡng cảnh báo tối thiểu */}
                  <div
                    className={`p-4 rounded-2xl border transition-colors ${
                      fieldErrors.minThreshold
                        ? 'border-red-300 bg-red-50/30'
                        : 'border-slate-200/80 bg-slate-50/70 hover:border-amber-300'
                    }`}
                  >
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      <AlertTriangle
                        className={`w-4 h-4 ${
                          fieldErrors.minThreshold ? 'text-red-500' : 'text-amber-500'
                        }`}
                      />
                      Ngưỡng cảnh báo tối thiểu ({formData.unit}){' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        name="minThreshold"
                        min="0"
                        step="0.01"
                        value={formData.minThreshold}
                        onChange={handleChange}
                        onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                        placeholder="0"
                        className={`w-full pl-4 pr-16 py-2.5 bg-white border rounded-xl text-sm font-bold text-slate-800 outline-none transition-all ${
                          fieldErrors.minThreshold
                            ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                            : 'border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10'
                        }`}
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        {formData.unit}
                      </span>
                    </div>
                    {fieldErrors.minThreshold ? (
                      <p className="mt-1.5 text-[11px] text-red-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {fieldErrors.minThreshold}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-slate-400 font-medium">
                        Hệ thống sẽ cảnh báo khi số lượng giảm xuống dưới ngưỡng này.
                      </p>
                    )}
                  </div>

                  {/* 2. Nhà cung cấp */}
                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 hover:border-indigo-300 transition-colors">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      <Truck className="w-4 h-4 text-indigo-500" />
                      Nhà cung cấp
                    </label>
                    <select
                      name="supplierId"
                      value={formData.supplierId}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all cursor-pointer"
                    >
                      <option value="">-- Chưa gắn nhà cung cấp --</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} {supplier.phone ? `(${supplier.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11px] text-slate-400 font-medium">
                      {suppliers.length > 0
                        ? `Có ${suppliers.length} đối tác trong trang trại này.`
                        : 'Chưa có nhà cung cấp nào được tạo.'}
                    </p>
                  </div>

                  {/* 3. Giá tiền theo đơn vị đóng gói */}
                  <div className="col-span-1 sm:col-span-2">
                    <PricingSection
                      isEditMode={true}
                      formData={formData}
                      error={fieldErrors.pricePerPackage}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* 3. Đường dẫn hình ảnh */}
                <div
                  className={`p-4 rounded-2xl border transition-colors space-y-3 ${
                    fieldErrors.imageUrl
                      ? 'border-red-300 bg-red-50/30'
                      : 'border-slate-200/80 bg-slate-50/70 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                      Ảnh sản phẩm
                    </label>
                    {formData.imageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, imageUrl: '' }));
                          setFieldErrors((prev) => ({ ...prev, imageUrl: undefined }));
                          setImageError(false);
                        }}
                        className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors"
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="flex-1 w-full">
                      <input
                        type="url"
                        name="imageUrl"
                        value={formData.imageUrl}
                        onChange={handleChange}
                        placeholder="https://example.com/hinh-anh-san-pham.jpg"
                        className={`w-full px-4 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-medium text-slate-800 outline-none transition-all ${
                          fieldErrors.imageUrl
                            ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                        }`}
                      />
                      {fieldErrors.imageUrl && (
                        <p className="mt-1.5 text-[11px] text-red-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {fieldErrors.imageUrl}
                        </p>
                      )}
                      {!fieldErrors.imageUrl && imageError && formData.imageUrl && (
                        <p className="mt-1.5 text-[11px] text-amber-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          Không thể hiển thị ảnh từ link này. Vui lòng kiểm tra lại URL.
                        </p>
                      )}
                    </div>

                    {formData.imageUrl && (
                      <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white flex items-center justify-center shadow-sm">
                        <img
                          src={formData.imageUrl}
                          alt="Xem trước"
                          className="w-full h-full object-cover"
                          onError={() => setImageError(true)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Ghi chú / Mô tả */}
                <div
                  className={`p-4 rounded-2xl border transition-colors ${
                    fieldErrors.description
                      ? 'border-red-300 bg-red-50/30'
                      : 'border-slate-200/80 bg-slate-50/70 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-slate-500" />
                      Ghi chú chi tiết
                    </label>
                    <span
                      className={`text-[11px] font-semibold ${
                        formData.description.length > 500 ? 'text-red-500' : 'text-slate-400'
                      }`}
                    >
                      {formData.description.length}/500
                    </span>
                  </div>
                  <textarea
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Nhập ghi chú hướng dẫn sử dụng, bảo quản, ..."
                    className={`w-full px-4 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-medium text-slate-800 outline-none transition-all resize-none ${
                      fieldErrors.description
                        ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                    }`}
                  />
                  {fieldErrors.description && (
                    <p className="mt-1 text-[11px] text-red-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.description}
                    </p>
                  )}
                </div>
              </div>
            </form>
          ) : (
            /* ======================================================== */
            /* CHẾ ĐỘ 2: THÊM VẬT TƯ MỚI (CREATE MODE)                   */
            /* ======================================================== */
            <>
              {step === 1 ? (
                <div className="space-y-4 py-6">
                  <p className="text-base sm:text-lg font-bold text-slate-700 mb-6 text-center">
                    Bạn muốn thêm loại sản phẩm nào vào kho?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, category: 'FEED' }));
                        setStep(2);
                      }}
                      className="flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-3xl border-2 border-amber-100 bg-amber-50/60 hover:bg-amber-100/70 hover:border-amber-300 transition-all group shadow-sm hover:shadow"
                    >
                      <div className="w-16 h-16 bg-amber-200/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Package className="w-8 h-8 text-amber-600" />
                      </div>
                      <span className="font-black text-amber-800 text-base sm:text-lg">Thức ăn</span>
                      <span className="text-[11px] text-amber-600/80 font-medium text-center">
                        Cám, thức ăn mảnh, thức ăn trụ tròn
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, category: 'MEDICINE' }));
                        setStep(2);
                      }}
                      className="flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-3xl border-2 border-rose-100 bg-rose-50/60 hover:bg-rose-100/70 hover:border-rose-300 transition-all group shadow-sm hover:shadow"
                    >
                      <div className="w-16 h-16 bg-rose-200/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Pill className="w-8 h-8 text-rose-600" />
                      </div>
                      <span className="font-black text-rose-800 text-base sm:text-lg">Thuốc</span>
                      <span className="text-[11px] text-rose-600/80 font-medium text-center">
                        Kháng sinh, khoáng tạt, vitamin bổ trợ
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, category: 'CHEMICAL' }));
                        setStep(2);
                      }}
                      className="flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-3xl border-2 border-cyan-100 bg-cyan-50/60 hover:bg-cyan-100/70 hover:border-cyan-300 transition-all group shadow-sm hover:shadow"
                    >
                      <div className="w-16 h-16 bg-cyan-200/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FlaskConical className="w-8 h-8 text-cyan-600" />
                      </div>
                      <span className="font-black text-cyan-800 text-base sm:text-lg">Hóa chất</span>
                      <span className="text-[11px] text-cyan-600/80 font-medium text-center">
                        Vi sinh, vôi, hóa chất xử lý nước ao
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <form id="inventoryForm" onSubmit={handleSubmit} className="space-y-6">
                  {/* Phân loại đã chọn & Nút quay lại */}
                  <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Phân loại:
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${categoryMeta.badgeClass}`}
                      >
                        {categoryMeta.icon}
                        {categoryMeta.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl hover:bg-slate-200/70"
                    >
                      <ChevronLeft className="w-4 h-4" /> Đổi phân loại
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Tên sản phẩm */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Tên sản phẩm <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="itemName"
                        required
                        value={formData.itemName}
                        onChange={handleChange}
                        placeholder="Ví dụ: Thức ăn Tôm Số 1, Vi sinh Probiotic..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      />
                    </div>

                    {/* Quy cách đóng gói */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Quy cách đóng gói <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="packageType"
                        value={formData.packageType}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                      >
                        <option value="Bao">Bao</option>
                        <option value="Chai">Chai</option>
                        <option value="Gói">Gói</option>
                        <option value="Can">Can</option>
                        <option value="Thùng">Thùng</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>

                    {/* Số lượng gói ban đầu */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Số lượng ban đầu ({formData.packageType})
                      </label>
                      <input
                        type="number"
                        name="packageQty"
                        min="0"
                        step="0.01"
                        value={formData.packageQty}
                        onChange={handleChange}
                        onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      />
                    </div>

                    {/* Định lượng 1 gói */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Định lượng 1 {formData.packageType}
                      </label>
                      <input
                        type="number"
                        name="weightPerPkg"
                        min="0"
                        step="0.01"
                        value={formData.weightPerPkg}
                        onChange={handleChange}
                        onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      />
                    </div>

                    {/* Đơn vị */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Đơn vị đo lường cơ bản <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                      >
                        <option value="kg">kg (Kilogram)</option>
                        <option value="g">g (Gram)</option>
                        <option value="lít">lít (Liters)</option>
                        <option value="ml">ml (Milliliters)</option>
                      </select>
                    </div>

                    {/* Preview Tổng số lượng */}
                    <div className="col-span-1 md:col-span-2">
                      <div className="px-4 py-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-blue-900 text-xs sm:text-sm flex items-center gap-2.5">
                        <Info className="w-5 h-5 text-blue-600 shrink-0" />
                        <span>
                          Tổng lượng kho khởi tạo:{' '}
                          <strong className="text-blue-700 text-sm font-black">
                            {Number(formData.packageQty || 0) * Number(formData.weightPerPkg || 0)}{' '}
                            {formData.unit}
                          </strong>{' '}
                          ({formData.packageQty || 0} {formData.packageType} × {formData.weightPerPkg || 0}{' '}
                          {formData.unit})
                        </span>
                      </div>
                    </div>

                    {/* Đơn giá theo đơn vị đóng gói (Create mode) */}
                    <div className="col-span-1 md:col-span-2">
                      <PricingSection
                        isEditMode={false}
                        formData={formData}
                        error={fieldErrors.pricePerPackage}
                        onChange={handleChange}
                      />
                    </div>

                    {/* Thuộc tính thức ăn */}
                    {formData.category === 'FEED' && (
                      <div className="col-span-1 md:col-span-2 p-4 bg-amber-50/50 border border-amber-200/70 rounded-2xl space-y-4">
                        <h3 className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-2">
                          <Package className="w-4 h-4 text-amber-600" /> Đặc tính thức ăn
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Hình dạng hạt <span className="text-red-500">*</span>
                            </label>
                            <select
                              name="shape"
                              value={formData.shape}
                              onChange={handleChange}
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all cursor-pointer"
                            >
                              <option value="Mảnh">Mảnh (Flake/Crumble)</option>
                              <option value="Trụ tròn">Trụ tròn (Pellet)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Kích thước hạt <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="sizeSpec"
                              required={formData.category === 'FEED'}
                              value={formData.sizeSpec}
                              onChange={handleChange}
                              placeholder="Ví dụ: 0.1 - 0.8 mm..."
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ngưỡng cảnh báo */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Ngưỡng cảnh báo tối thiểu ({formData.unit})
                      </label>
                      <input
                        type="number"
                        name="minThreshold"
                        min="0"
                        step="0.01"
                        value={formData.minThreshold}
                        onChange={handleChange}
                        onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                      />
                    </div>

                    {/* Nhà cung cấp */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Nhà cung cấp
                      </label>
                      <select
                        name="supplierId"
                        value={formData.supplierId}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                      >
                        <option value="">Chưa chọn nhà cung cấp</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Đường link hình ảnh */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Đường dẫn hình ảnh (URL)
                      </label>
                      <input
                        type="url"
                        name="imageUrl"
                        value={formData.imageUrl}
                        onChange={handleChange}
                        placeholder="https://example.com/image.jpg"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      />
                    </div>

                    {/* Ghi chú */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mô tả chi tiết
                      </label>
                      <textarea
                        name="description"
                        rows={2}
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Nhập thông tin thêm về sản phẩm này..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm"
          >
            Hủy bỏ
          </button>

          {(isEditMode || step === 2) && (
            <button
              type="submit"
              form="inventoryForm"
              disabled={isLoading}
              className={`px-6 py-2.5 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${
                isEditMode
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isEditMode ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditMode ? 'Lưu cập nhật' : 'Thêm sản phẩm'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
