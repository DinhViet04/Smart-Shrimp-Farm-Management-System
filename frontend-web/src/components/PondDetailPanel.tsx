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
      {/* Overlay & Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={onClose}
        >
          {/* Centered Modal */}
          <div 
            className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-lg shadow-2xl border border-white/60 overflow-hidden flex flex-col max-h-[90vh] transform transition-all animate-in zoom-in-95 duration-300 z-[60]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100/50 flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white/80">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600 rounded-2xl flex items-center justify-center shadow-inner border border-cyan-100/50">
                  <Droplets className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-blue-600 tracking-tight">Chi tiết Ao Nuôi</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Main Info */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-black text-slate-800 leading-tight">{pond.name}</h3>
                  {pond.farm?.status === 'INACTIVE' ? (
                    <span className="px-3 py-1 text-xs font-bold rounded-xl border whitespace-nowrap shadow-sm bg-rose-50 text-rose-600 border-rose-200">
                      Ngưng hoạt động
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-xs font-bold rounded-xl border whitespace-nowrap shadow-sm bg-emerald-50 text-emerald-600 border-emerald-200">
                      Sẵn sàng
                    </span>
                  )}
                </div>
                
                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                  Thuộc trang trại: <span className="font-bold text-slate-800">{pond.farm?.name || 'Không xác định'}</span>
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex flex-col gap-1 items-start shadow-inner">
                  <div className="flex items-center gap-1.5 text-blue-600/80 text-xs font-bold uppercase tracking-wider">
                    <Maximize className="w-4 h-4" />
                    Diện tích
                  </div>
                  <p className="text-xl font-black text-slate-800">{pond.areaSize?.toLocaleString() || 0} <span className="text-sm font-bold text-slate-400">m²</span></p>
                </div>

                <div className="bg-cyan-50/50 p-4 rounded-2xl border border-cyan-100/50 flex flex-col gap-1 items-start shadow-inner">
                  <div className="flex items-center gap-1.5 text-cyan-600/80 text-xs font-bold uppercase tracking-wider">
                    <Activity className="w-4 h-4" />
                    Độ sâu
                  </div>
                  <p className="text-xl font-black text-slate-800">{pond.depth || 0} <span className="text-sm font-bold text-slate-400">m</span></p>
                </div>
              </div>

              {/* List Info */}
              <div className="space-y-4 pt-4 border-t border-slate-100/50">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-cyan-50/80 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-cyan-100/50 shadow-sm">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Địa chỉ trang trại</p>
                    <p className="text-sm text-slate-500 mt-1 font-medium">{pond.farm?.address || 'Không xác định'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-cyan-50/80 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-cyan-100/50 shadow-sm">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Ngày tạo ao</p>
                    <p className="text-sm text-slate-500 mt-1 font-medium">
                      {pond.createdAt ? new Date(pond.createdAt).toLocaleDateString('vi-VN') : 'Không xác định'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-cyan-50/80 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-cyan-100/50 shadow-sm">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Cập nhật lần cuối</p>
                    <p className="text-sm text-slate-500 mt-1 font-medium">
                      {pond.updatedAt ? new Date(pond.updatedAt).toLocaleDateString('vi-VN') : 'Không xác định'}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/50 bg-slate-50/80">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-slate-200/70 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
