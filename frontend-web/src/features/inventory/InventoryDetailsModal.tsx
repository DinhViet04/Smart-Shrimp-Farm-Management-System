import { X, Package, Pill, FlaskConical, Box, AlertTriangle, Building2, Tag, Layers, Droplets } from 'lucide-react';

// Get category details function
const getCategoryDetails = (category: string) => {
  switch (category) {
    case 'FEED':
      return { label: 'Thức ăn', color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200', icon: <Package className="w-4 h-4" /> };
    case 'MEDICINE':
      return { label: 'Thuốc', color: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200', icon: <Pill className="w-4 h-4" /> };
    case 'CHEMICAL':
      return { label: 'Hóa chất', color: 'text-cyan-600', bg: 'bg-cyan-100', border: 'border-cyan-200', icon: <FlaskConical className="w-4 h-4" /> };
    default:
      return { label: 'Khác', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: <Box className="w-4 h-4" /> };
  }
};

interface InventoryDetailsModalProps {
  isOpen: boolean;
  item: any;
  onClose: () => void;
}

export default function InventoryDetailsModal({ isOpen, item, onClose }: InventoryDetailsModalProps) {
  if (!isOpen || !item) return null;

  const cat = getCategoryDetails(item.category);
  const isLowStock = item.quantity <= item.minThreshold;
  const totalWeight = item.quantity || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col md:flex-row max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Image */}
        <div className="w-full md:w-2/5 bg-slate-100 relative min-h-[250px] flex items-center justify-center flex-shrink-0">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-contain absolute inset-0" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${cat.bg}`}>
               {item.category === 'FEED' && <Package className={`w-32 h-32 ${cat.color} opacity-40`} />}
               {item.category === 'MEDICINE' && <Pill className={`w-32 h-32 ${cat.color} opacity-40`} />}
               {item.category === 'CHEMICAL' && <FlaskConical className={`w-32 h-32 ${cat.color} opacity-40`} />}
               {!['FEED', 'MEDICINE', 'CHEMICAL'].includes(item.category) && <Box className={`w-32 h-32 ${cat.color} opacity-40`} />}
            </div>
          )}
          <button 
            onClick={onClose}
            className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm text-slate-500 hover:text-slate-800 rounded-full shadow-sm md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Right Side: Details */}
        <div className="w-full md:w-3/5 flex flex-col h-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 md:p-8 flex-1">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border mb-3 ${cat.bg} ${cat.color} ${cat.border}`}>
                  {cat.icon}
                  {cat.label}
                </span>
                <h2 className="text-2xl font-black text-slate-800 leading-tight">{item.itemName}</h2>
              </div>
              <button 
                onClick={onClose}
                className="hidden md:flex p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Description */}
            {item.description && (
              <p className="text-slate-600 text-sm leading-relaxed mb-8">{item.description}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {/* Stock Info */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                <span className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Tồn kho hiện tại
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800">{item.packageQty}</span>
                  <span className="text-slate-500 font-medium">{item.packageType}</span>
                </div>
                <div className="text-sm text-slate-500 mt-2 font-medium">
                  Tổng lượng: <strong className="text-slate-700">{totalWeight} {item.unit}</strong>
                </div>
                {isLowStock && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5" /> Sắp hết hàng (Dưới {item.minThreshold} {item.unit})
                  </div>
                )}
              </div>

              {/* Package Specs */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                <span className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-2">
                  <Droplets className="w-4 h-4" /> Quy cách đóng gói
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-800">{item.weightPerPkg}</span>
                  <span className="text-slate-500 font-medium">{item.unit} / {item.packageType}</span>
                </div>
              </div>
            </div>

            {/* Additional Info Grid */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">Thông tin bổ sung</h3>
              
              {/* Feed specific */}
              {item.category === 'FEED' && (
                <div className="grid grid-cols-2 gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
                  <div>
                    <span className="block text-xs font-bold text-slate-500 mb-1">Hình dạng thức ăn</span>
                    <span className="text-sm font-semibold text-slate-800">{item.shape || 'Đang cập nhật'}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-500 mb-1">Quy cách (Kích thước)</span>
                    <span className="text-sm font-semibold text-slate-800">{item.sizeSpec || 'Đang cập nhật'}</span>
                  </div>
                </div>
              )}

              {/* General details */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Đơn vị cơ bản
                  </span>
                  <span className="text-sm font-bold text-slate-800">{item.unit}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Ngưỡng cảnh báo
                  </span>
                  <span className="text-sm font-bold text-amber-600">{item.minThreshold} {item.unit}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Nhà cung cấp
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {item.supplier?.name || item.supplierName || 'Chưa cập nhật'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
