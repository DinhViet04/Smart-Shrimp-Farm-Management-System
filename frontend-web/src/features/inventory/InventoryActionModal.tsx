import { useState, type FormEvent, useEffect } from 'react';
import { X, PackagePlus, PackageMinus, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';

const sanitizeNumericInput = (val: string): string => {
  if (!val) return '';
  if (val.startsWith('0.') || val.startsWith('.')) return val;
  if (val === '0') return '0';
  return val.replace(/^0+(?=\d)/, '');
};

interface InventoryActionModalProps {
  isOpen: boolean;
  item: any | null;
  items?: any[];
  initialAction?: 'IMPORT' | 'EXPORT';
  ponds?: any[];
  selectedFarmId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const USAGE_PURPOSES = [
  { id: 'FEEDING', label: 'Cho tôm ăn', icon: '🦐', desc: 'Cho ăn hàng ngày theo cử' },
  { id: 'WATER_TREATMENT', label: 'Xử lý nước ao', icon: '🧪', desc: 'Đánh vi sinh, vôi, hóa chất' },
  { id: 'TREATMENT', label: 'Điều trị bệnh tôm', icon: '💊', desc: 'Trộn thuốc kháng sinh, bổ tôm' },
  { id: 'EQUIPMENT', label: 'Bảo trì / Vệ sinh', icon: '⚙️', desc: 'Vệ sinh quạt, bạt ao, thiết bị' },
  { id: 'LOSS_EXPIRED', label: 'Hao hụt / Hết hạn', icon: '⚠️', desc: 'Hàng hỏng, hết hạn, sự cố' },
  { id: 'OTHER', label: 'Mục đích khác', icon: '✏️', desc: 'Nhu cầu sử dụng riêng khác' },
];

export default function InventoryActionModal({
  isOpen,
  item,
  items,
  initialAction,
  onClose,
  onSuccess
}: InventoryActionModalProps) {
  const [actionType, setActionType] = useState<'IMPORT' | 'EXPORT'>('EXPORT');
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const activeItem = item || items?.find((i) => i.id === selectedItemId) || items?.[0] || null;

  // Separate states for Import and Export for clean validation and independent form handling
  const [importForm, setImportForm] = useState({
    packages: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [exportForm, setExportForm] = useState({
    quantity: '',
    date: new Date().toISOString().slice(0, 10),
    purpose: 'OTHER',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setSelectedItemId(item.id);
      } else if (items && items.length > 0) {
        setSelectedItemId(items[0].id);
      }
      if (initialAction) {
        setActionType(initialAction);
      } else {
        setActionType('EXPORT');
      }
    }
  }, [isOpen, item, items, initialAction]);

  useEffect(() => {
    if (isOpen && activeItem) {
      let defaultPurpose = 'OTHER';
      if (activeItem.category === 'FEED') defaultPurpose = 'FEEDING';
      else if (activeItem.category === 'MEDICINE') defaultPurpose = 'TREATMENT';
      else if (activeItem.category === 'CHEMICAL') defaultPurpose = 'WATER_TREATMENT';

      setImportForm({
        packages: '',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      });

      setExportForm({
        quantity: '',
        date: new Date().toISOString().slice(0, 10),
        purpose: defaultPurpose,
        notes: '',
      });
    }
  }, [isOpen, activeItem?.id]);

  if (!isOpen || !activeItem) return null;

  const packageType = activeItem.packageType?.trim() || 'Bao / Chai';
  const weightPerPkg = Number(activeItem.weightPerPkg) > 0 ? Number(activeItem.weightPerPkg) : null;

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value || 0);
  };

  // Import calculations
  const numImportPackages = Number(importForm.packages) > 0 ? Number(importForm.packages) : 0;
  const calculatedImportQuantity = weightPerPkg ? numImportPackages * weightPerPkg : numImportPackages;
  const projectedPackageQty = (activeItem.packageQty || 0) + numImportPackages;
  const projectedBaseQuantity = activeItem.quantity + (weightPerPkg ? calculatedImportQuantity : numImportPackages);

  // Export calculations
  const numExportQuantity = Number(exportForm.quantity) > 0 ? Number(exportForm.quantity) : 0;
  const isExportExceeded = numExportQuantity > activeItem.quantity;
  const equivalentExportPackages = weightPerPkg && numExportQuantity > 0 
    ? (numExportQuantity / weightPerPkg).toFixed(1) 
    : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeItem || !actionType) return;

    if (actionType === 'IMPORT') {
      if (!numImportPackages || numImportPackages <= 0) {
        alert(`Vui lòng nhập số lượng ${packageType.toLowerCase()} lớn hơn 0`);
        return;
      }

      setIsSubmitting(true);
      try {
        await inventoryService.recordImport(activeItem.id, {
          packagesAdded: numImportPackages,
          quantityAdded: calculatedImportQuantity,
          importDate: importForm.date,
          notes: importForm.notes.trim(),
        });
        onSuccess(`Ghi nhận nhập kho thành công: +${formatNumber(numImportPackages)} ${packageType}!`);
        onClose();
      } catch (error: any) {
        alert(error.message || 'Có lỗi xảy ra khi nhập kho');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // EXPORT
      if (!numExportQuantity || numExportQuantity <= 0) {
        alert('Số lượng xuất phải lớn hơn 0');
        return;
      }

      if (isExportExceeded) {
        alert(`Số lượng xuất (${formatNumber(numExportQuantity)} ${activeItem.unit}) vượt quá tồn kho (${formatNumber(activeItem.quantity)} ${activeItem.unit})`);
        return;
      }

      setIsSubmitting(true);
      try {
        const purposeObj = USAGE_PURPOSES.find((p) => p.id === exportForm.purpose);
        const purposeLabel = purposeObj ? `${purposeObj.icon} ${purposeObj.label}` : exportForm.purpose;
        const noteText = exportForm.notes.trim() ? ` — ${exportForm.notes.trim()}` : '';
        const formattedNotes = `[Mục đích: ${purposeLabel}]${noteText}`;

        await inventoryService.recordUsage(activeItem.id, {
          quantityUsed: numExportQuantity,
          usageDate: exportForm.date,
          notes: formattedNotes,
        });
        onSuccess(`Ghi nhận xuất kho thành công: -${formatNumber(numExportQuantity)} ${activeItem.unit}!`);
        onClose();
      } catch (error: any) {
        alert(error.message || 'Có lỗi xảy ra khi xuất kho');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-xl border border-white/70 rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-300 max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/70 flex items-center justify-between bg-white/70">
          <div className="flex-1 mr-4">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              Quản lý Nhập / Xuất Kho
            </h3>
            
            {/* If product was not fixed, allow selecting product */}
            {!item && items && items.length > 1 ? (
              <div className="mt-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Chọn sản phẩm:
                </label>
                <select
                  value={activeItem.id}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemName} (Tồn: {formatNumber(i.quantity)} {i.unit})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-semibold mt-1">
                <span>Sản phẩm:</span>
                <span className="text-indigo-900 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/80">
                  {activeItem.itemName}
                </span>
                <span>•</span>
                <span>Tồn hiện tại:</span>
                <span className="font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                  {activeItem.packageQty != null 
                    ? `${formatNumber(activeItem.packageQty)} ${packageType} (${formatNumber(activeItem.quantity)} ${activeItem.unit})`
                    : `${formatNumber(activeItem.quantity)} ${activeItem.unit}`}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-5 pb-2">
          <div className="flex p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/50">
            <button
              type="button"
              onClick={() => setActionType('IMPORT')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${
                actionType === 'IMPORT' 
                  ? 'bg-white text-blue-700 shadow-md shadow-blue-500/10 border border-blue-100' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <PackagePlus className="w-4 h-4 text-blue-600" /> Nhập Kho
            </button>
            <button
              type="button"
              onClick={() => setActionType('EXPORT')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${
                actionType === 'EXPORT' 
                  ? 'bg-white text-emerald-700 shadow-md shadow-emerald-500/10 border border-emerald-100' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <PackageMinus className="w-4 h-4 text-emerald-600" /> Xuất Kho
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="p-6 pt-3 flex-1 overflow-y-auto">
          {actionType === 'IMPORT' ? (
            /* FORM NHẬP KHO (Nhập theo số lượng chai hoặc bao) */
            <form onSubmit={handleSubmit} className="space-y-4 animate-in slide-in-from-left-3 fade-in duration-300" key="import-form">
              {/* Packaging Rule Alert */}
              <div className="p-3.5 bg-blue-50/80 border border-blue-200/70 rounded-2xl text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="leading-relaxed">
                  <p className="font-bold">Nhập theo quy cách đóng gói ({packageType}):</p>
                  <p className="text-blue-700 mt-0.5">
                    {weightPerPkg ? (
                      <>1 {packageType} = <b>{weightPerPkg} {item.unit}</b>. Số lượng nhập sẽ tự động nhân quy cách để tính vào tổng tồn kho cơ bản.</>
                    ) : (
                      <>Nhập số lượng theo đơn vị <b>{packageType}</b> thực tế đưa vào kho.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Quantity in Packages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    1. Số lượng nhập ({packageType}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={importForm.packages}
                    onChange={(e) => {
                      const v = sanitizeNumericInput(e.target.value);
                      if (e.target.value !== v) e.target.value = v;
                      setImportForm({ ...importForm, packages: v });
                    }}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                    placeholder={`Nhập số lượng ${packageType.toLowerCase()}...`}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 outline-none hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Chỉ nhập số {packageType.toLowerCase()}, không nhập theo {item.unit}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    2. Ngày nhập kho <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={importForm.date}
                    onChange={(e) => setImportForm({ ...importForm, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 outline-none hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* Real-time Calculation Preview Card */}
              {numImportPackages > 0 && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/70 border border-blue-200/80 shadow-sm space-y-2 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between font-medium text-slate-600">
                    <span>Số lượng nhập:</span>
                    <span className="font-bold text-blue-700">+{formatNumber(numImportPackages)} {packageType}</span>
                  </div>
                  {weightPerPkg && (
                    <div className="flex items-center justify-between font-medium text-slate-600">
                      <span>Khối lượng quy đổi ({weightPerPkg} {item.unit}/{packageType}):</span>
                      <span className="font-bold text-indigo-700">+{formatNumber(calculatedImportQuantity)} {item.unit}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between font-bold text-slate-800">
                    <span className="flex items-center gap-1.5 text-blue-950">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Tồn dự kiến sau khi nhập:
                    </span>
                    <span className="text-blue-900 font-black">
                      {formatNumber(projectedPackageQty)} {packageType}
                      {weightPerPkg && ` (~${formatNumber(projectedBaseQuantity)} ${item.unit})`}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Ghi chú nhập kho
                </label>
                <textarea
                  value={importForm.notes}
                  onChange={(e) => setImportForm({ ...importForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 outline-none hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm"
                  placeholder="Ví dụ: Nhập hàng từ nhà cung cấp, số hóa đơn, số lô sản xuất..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-200/60 mt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || numImportPackages <= 0}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 hover:-translate-y-0.5 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <PackagePlus className="w-4 h-4" /> Xác nhận nhập kho
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* FORM XUẤT KHO (Đã bỏ 2. Ao nuôi áp dụng theo yêu cầu) */
            <form onSubmit={handleSubmit} className="space-y-4 animate-in slide-in-from-right-3 fade-in duration-300" key="export-form">
              {/* 1. Mục đích xuất kho */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Mục đích xuất kho <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {USAGE_PURPOSES.map((p) => {
                    const isSelected = exportForm.purpose === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setExportForm({ ...exportForm, purpose: p.id })}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/20 text-emerald-950 font-bold shadow-sm'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-sm'
                        }`}
                      >
                        <span className="text-lg leading-none">{p.icon}</span>
                        <div>
                          <p className="text-xs font-bold leading-tight">{p.label}</p>
                          <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">{p.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Số lượng xuất & Ngày */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    2. Số lượng xuất ({item.unit}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={exportForm.quantity}
                    onChange={(e) => {
                      const v = sanitizeNumericInput(e.target.value);
                      if (e.target.value !== v) e.target.value = v;
                      setExportForm({ ...exportForm, quantity: v });
                    }}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                    placeholder={`Nhập số lượng xuất...`}
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-all shadow-sm ${
                      isExportExceeded
                        ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                        : 'border-slate-200 bg-white hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                    }`}
                    required
                  />
                  {isExportExceeded ? (
                    <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Vượt quá tồn kho ({formatNumber(item.quantity)} {item.unit})!
                    </p>
                  ) : (
                    equivalentExportPackages && (
                      <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                        ≈ {equivalentExportPackages} {packageType.toLowerCase()}
                      </p>
                    )
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ngày xuất kho / sử dụng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={exportForm.date}
                    onChange={(e) => setExportForm({ ...exportForm, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 outline-none hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* 3. Ghi chú chi tiết */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Ghi chú chi tiết thêm
                </label>
                <textarea
                  value={exportForm.notes}
                  onChange={(e) => setExportForm({ ...exportForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 outline-none hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none shadow-sm"
                  placeholder="Ví dụ: Đánh vi sinh định kỳ buổi sáng, liều lượng theo chỉ dẫn của kỹ sư..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-200/60 mt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || numExportQuantity <= 0 || isExportExceeded}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 hover:-translate-y-0.5 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <PackageMinus className="w-4 h-4" /> Xác nhận xuất kho
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
