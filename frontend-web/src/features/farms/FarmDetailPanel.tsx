import { useState } from 'react';
import { X, MapPin, Maximize, Calendar, Activity, Info, Building2, Waves, Eye } from 'lucide-react';
import PondDetailPanel from '../../components/PondDetailPanel';

interface FarmDetailPanelProps {
  farm: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FarmDetailPanel({ farm, isOpen, onClose }: FarmDetailPanelProps) {
  const [viewingPond, setViewingPond] = useState<any | null>(null);

  if (!farm) return null;

  return (
    <>
      {/* Overlay & Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={onClose}
        >
          {/* Centered Modal */}
          <div 
            className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-lg shadow-2xl border border-white/60 overflow-hidden flex flex-col max-h-[90vh] transform transition-all animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100/50 flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white/80">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100/50">
                  <Building2 className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500 tracking-tight">Chi tiết Trang Trại</h2>
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
                  <h3 className="text-2xl font-black text-slate-800 leading-tight">{farm.name}</h3>
                  <span className={`px-3 py-1 text-xs font-bold rounded-xl border whitespace-nowrap shadow-sm ${
                    farm.status === 'ACTIVE' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                      : 'bg-rose-50 text-rose-600 border-rose-200'
                  }`}>
                    {farm.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}
                  </span>
                </div>
                
                {farm.description && (
                  <p className="text-slate-500 text-sm leading-relaxed mb-4">
                    {farm.description}
                  </p>
                )}
              </div>

              {/* Details Grid (Premium Pills) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex flex-col gap-1 items-start shadow-inner">
                  <div className="flex items-center gap-1.5 text-blue-600/80 text-xs font-bold uppercase tracking-wider">
                    <Maximize className="w-4 h-4" />
                    Diện tích
                  </div>
                  <p className="text-xl font-black text-slate-800">{farm.area?.toLocaleString() || 0} <span className="text-sm font-bold text-slate-400">m²</span></p>
                </div>

                <div className="bg-cyan-50/50 p-4 rounded-2xl border border-cyan-100/50 flex flex-col gap-1 items-start shadow-inner">
                  <div className="flex items-center gap-1.5 text-cyan-600/80 text-xs font-bold uppercase tracking-wider">
                    <Activity className="w-4 h-4" />
                    Số lượng ao
                  </div>
                  <p className="text-xl font-black text-slate-800">{farm.ponds?.length || 0} <span className="text-sm font-bold text-slate-400">ao</span></p>
                </div>
              </div>

              {/* List Info */}
              <div className="space-y-4 pt-4 border-t border-slate-100/50">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50/80 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-100/50 shadow-sm">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Địa chỉ chi tiết</p>
                    <p className="text-sm text-slate-500 mt-1 font-medium">{farm.address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50/80 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-100/50 shadow-sm">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Ngày tạo</p>
                    <p className="text-sm text-slate-500 mt-1 font-medium">
                      {farm.createdAt ? new Date(farm.createdAt).toLocaleDateString('vi-VN') : 'Không xác định'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pond List */}
              {farm.ponds && farm.ponds.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-slate-100/50">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Waves className="w-4 h-4 text-blue-500" /> 
                    Danh sách Ao nuôi ({farm.ponds.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {farm.ponds.map((pond: any) => (
                      <div 
                        key={pond.id}
                        onClick={() => setViewingPond(pond)}
                        className="p-4 bg-white border border-slate-100 rounded-2xl cursor-pointer hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5 hover:border-blue-200 transition-all flex justify-between items-center group"
                      >
                        <div>
                          <p className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{pond.name}</p>
                          <p className="text-xs text-slate-500 font-medium mt-1">{pond.areaSize} m² • Sâu {pond.depth}m</p>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shadow-sm text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100/50 bg-slate-50/80">
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

      <PondDetailPanel 
        pond={viewingPond} 
        isOpen={!!viewingPond} 
        onClose={() => setViewingPond(null)} 
      />
    </>
  );
}
