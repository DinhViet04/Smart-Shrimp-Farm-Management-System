import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Package, Pill, FlaskConical, ChevronLeft } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { supplierService } from '../../services/supplier.service';

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
    supplierId: '',
    description: '',
    imageUrl: '',
    shape: 'Mảnh',
    sizeSpec: '',
  });

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);

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
        supplierId: initialData.supplierId || initialData.supplier?.id || '',
        description: initialData.description || '',
        imageUrl: initialData.imageUrl || '',
        shape: initialData.shape || 'Mảnh',
        sizeSpec: initialData.sizeSpec || '',
      });
      setStep(2);
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
        supplierId: '',
        description: '',
        imageUrl: '',
        shape: 'Mảnh',
        sizeSpec: '',
      });
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

          {step === 1 ? (
            <div className="space-y-4 py-8">
              <p className="text-lg font-bold text-slate-700 mb-6 text-center">Bạn muốn thêm loại vật tư nào?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, category: 'FEED' }));
                    setStep(2);
                  }}
                  className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 border-amber-100 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-all group"
                >
                  <div className="w-16 h-16 bg-amber-200/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Package className="w-8 h-8 text-amber-600" />
                  </div>
                  <span className="font-black text-amber-700 text-lg">Thức ăn</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, category: 'MEDICINE' }));
                    setStep(2);
                  }}
                  className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 border-rose-100 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-all group"
                >
                  <div className="w-16 h-16 bg-rose-200/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Pill className="w-8 h-8 text-rose-600" />
                  </div>
                  <span className="font-black text-rose-700 text-lg">Thuốc</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, category: 'CHEMICAL' }));
                    setStep(2);
                  }}
                  className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 border-cyan-100 bg-cyan-50 hover:bg-cyan-100 hover:border-cyan-300 transition-all group"
                >
                  <div className="w-16 h-16 bg-cyan-200/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FlaskConical className="w-8 h-8 text-cyan-600" />
                  </div>
                  <span className="font-black text-cyan-700 text-lg">Hóa chất</span>
                </button>
              </div>
            </div>
          ) : (
            <form id="inventoryForm" onSubmit={handleSubmit} className="space-y-6">
              {/* Phân loại đã chọn & Nút quay lại */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-500">Phân loại đang chọn:</span>
                  <span className="text-sm font-black text-blue-700 bg-blue-100 px-3 py-1 rounded-lg">
                    {formData.category === 'FEED' ? 'Thức ăn' : formData.category === 'MEDICINE' ? 'Thuốc' : 'Hóa chất'}
                  </span>
                </div>
                {!initialData && (
                  <button 
                    type="button" 
                    onClick={() => setStep(1)}
                    className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4" /> Thay đổi
                  </button>
                )}
              </div>

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

              {/* Thuộc tính dành riêng cho Thức ăn */}
              {formData.category === 'FEED' && (
                <>
                  <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                    <h3 className="text-sm font-bold text-amber-600 mb-4 uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4" /> Đặc tính thức ăn
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Hình dạng thức ăn <span className="text-red-500">*</span></label>
                        <select
                          name="shape"
                          value={formData.shape}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                        >
                          <option value="Mảnh">Mảnh (Flake/Crumble)</option>
                          <option value="Trụ tròn">Trụ tròn (Pellet)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Quy cách (Kích thước) <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="sizeSpec"
                          required={formData.category === 'FEED'}
                          value={formData.sizeSpec}
                          onChange={handleChange}
                          placeholder="Ví dụ: 0.1 - 0.8 mm"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

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
                <select
                  name="supplierId"
                  value={formData.supplierId}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">Chưa chọn nhà cung cấp</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600 font-medium">Chưa có nhà cung cấp. Vui lòng tạo nhà cung cấp trước trong danh sách nhà cung cấp.</p>
                )}
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

              {/* Đường dẫn hình ảnh */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Đường dẫn hình ảnh (URL)</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="url"
                      name="imageUrl"
                      value={formData.imageUrl}
                      onChange={handleChange}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    />
                    <p className="mt-2 text-xs text-slate-500">Dán đường link hình ảnh để hiển thị trực quan</p>
                  </div>
                  {formData.imageUrl && (
                    <div className="w-24 h-24 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center">
                      <img 
                        src={formData.imageUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Lỗi+Ảnh';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            </form>
          )}
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
          {step === 2 && (
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
          )}
        </div>
      </div>
    </div>
  );
}
