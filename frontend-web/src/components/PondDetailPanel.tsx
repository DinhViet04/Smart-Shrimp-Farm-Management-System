import { X, MapPin, Maximize, Calendar, Activity, Info, Droplets } from 'lucide-react';

interface PondDetailPanelProps {
  pond: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PondDetailPanel({ pond, isOpen, onClose }: PondDetailPanelProps) {
  if (!pond) return null;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-over Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-100 text-cyan-600 rounded-xl flex items-center justify-center">
              <Droplets className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Chi tiết Ao Nuôi</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Main Info */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-2xl font-black text-slate-900 leading-tight">{pond.name}</h3>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border whitespace-nowrap bg-emerald-50 text-emerald-600 border-emerald-100`}>
                Sẵn sàng
              </span>
            </div>
            
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Thuộc trang trại: <span className="font-semibold text-slate-800">{pond.farm?.name || 'Không xác định'}</span>
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Maximize className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Diện tích</span>
              </div>
              <p className="text-lg font-bold text-slate-800">{pond.areaSize?.toLocaleString() || 0} m²</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Độ sâu</span>
              </div>
              <p className="text-lg font-bold text-slate-800">{pond.depth || 0} m</p>
            </div>
          </div>

          {/* List Info */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Địa chỉ trang trại</p>
                <p className="text-sm text-slate-500 mt-1">{pond.farm?.address || 'Không xác định'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Ngày tạo ao</p>
                <p className="text-sm text-slate-500 mt-1">
                  {pond.createdAt ? new Date(pond.createdAt).toLocaleDateString('vi-VN') : 'Không xác định'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Cập nhật lần cuối</p>
                <p className="text-sm text-slate-500 mt-1">
                  {pond.updatedAt ? new Date(pond.updatedAt).toLocaleDateString('vi-VN') : 'Không xác định'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </>
  );
}
