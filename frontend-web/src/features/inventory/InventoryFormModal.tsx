import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Package } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';

interface InventoryFormModalProps {
  isOpen: boolean;
  initialData?: any;
  selectedFarmId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function InventoryFormModal({ isOpen, initialData, selectedFarmId, onClose, onSuccess }: InventoryFormModalProps) {
  const [formData, setFormData] = useState({
    itemName: '',
    category: 'FEED',
    packageType: 'Bao',
    packageQty: 0,
    weightPerPkg: 0,
    quantity: 0,
    unit: 'kg',
    minThreshold: 0,
    supplier: '',
    description: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        itemName: initialData.itemName || '',
        category: initialData.category || 'FEED',
        packageType: initialData.packageType || 'Bao',
        packageQty: initialData.packageQty || 0,
        weightPerPkg: initialData.weightPerPkg || 0,
        quantity: initialData.quantity || 0,
        unit: initialData.unit || 'kg',
        minThreshold: initialData.minThreshold || 0,
        supplier: initialData.supplier || '',
        description: initialData.description || '',
      });
    } else {
      setFormData({
        itemName: '',
        category: 'FEED',
        packageType: 'Bao',
        packageQty: 0,
        weightPerPkg: 0,
        quantity: 0,
        unit: 'kg',
        minThreshold: 0,
        supplier: '',
        description: '',
      });
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (initialData) {
        await inventoryService.update(initialData.id, { ...formData, farmId: selectedFarmId });
        onSuccess('Cập nhật vật tư thành công!');
      } else {
        await inventoryService.create({ ...formData, farmId: selectedFarmId });
        onSuccess('Thêm vật tư thành công!');
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {initialData ? 'Cập nhật Vật tư' : 'Thêm Vật tư mới'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">Nhập thông tin chi tiết của vật tư, thức ăn</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form id="inventoryForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tên vật tư */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tên vật tư <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="itemName"
                  required
                  value={formData.itemName}
                  onChange={handleChange}
                  placeholder="Ví dụ: Thức ăn Tôm Số 1..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              {/* Loại vật tư */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Phân loại <span className="text-red-500">*</span></label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="FEED">Thức ăn</option>
                  <option value="MEDICINE">Thuốc</option>
                  <option value="CHEMICAL">Hóa chất</option>
                </select>
              </div>

              {/* Quy cách đóng gói */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Quy cách đóng gói <span className="text-red-500">*</span></label>
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
                  <option value="Khác">Khác</option>
                </select>
              </div>

              {/* Số lượng */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Số lượng ({formData.packageType})</label>
                <input
                  type="number"
                  name="packageQty"
                  min="0"
                  step="0.01"
                  value={formData.packageQty}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              {/* Trọng lượng 1 gói */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Định lượng 1 {formData.packageType}</label>
                <input
                  type="number"
                  name="weightPerPkg"
                  min="0"
                  step="0.01"
                  value={formData.weightPerPkg}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              {/* Đơn vị */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Đơn vị đo lường cơ bản <span className="text-red-500">*</span></label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="lít">lít</option>
                  <option value="ml">ml</option>
                </select>
              </div>

              {/* Preview Tổng số lượng */}
              <div className="col-span-1 md:col-span-2">
                <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-500" />
                  <span>
                    Tổng số lượng kho: <strong>{(formData.packageQty * formData.weightPerPkg) || 0} {formData.unit}</strong> 
                    {' '}({formData.packageQty} {formData.packageType} x {formData.weightPerPkg} {formData.unit})
                  </span>
                </div>
              </div>

              {/* Ngưỡng cảnh báo */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Ngưỡng cảnh báo tối thiểu</label>
                <input
                  type="number"
                  name="minThreshold"
                  min="0"
                  step="0.01"
                  value={formData.minThreshold}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                />
              </div>

              {/* Nhà cung cấp */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Nhà cung cấp</label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  placeholder="Nhập tên nhà cung cấp..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              {/* Ghi chú */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Mô tả / Ghi chú</label>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Nhập thông tin thêm về vật tư này..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
                ></textarea>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="inventoryForm"
            disabled={isLoading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-70"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Lưu vật tư
          </button>
        </div>
      </div>
    </div>
  );
}
