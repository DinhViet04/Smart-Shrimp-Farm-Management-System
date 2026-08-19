import { useState, useEffect } from 'react';
import { X, MapPin, Maximize, Calendar, Activity, Building2, Waves, Eye, Users, UserPlus, Trash2 } from 'lucide-react';
import PondDetailPanel from '../../components/PondDetailPanel';
import { farmService } from '../../services/farm.service';

interface FarmDetailPanelProps {
  farm: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function FarmDetailPanel({ farm, isOpen, onClose }: FarmDetailPanelProps) {
  const [viewingPond, setViewingPond] = useState<any | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [emailToAssign, setEmailToAssign] = useState('');
  const [roleToAssign, setRoleToAssign] = useState<'FARMER' | 'TECHNICIAN'>('FARMER');
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Get currently logged in user info
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Fetch staff list when farm details open
  useEffect(() => {
    if (isOpen && farm?.id) {
      fetchStaff();
    } else {
      setStaffList([]);
      setEmailToAssign('');
      setErrorMessage(null);
    }
  }, [isOpen, farm?.id]);

  const isOwner = currentUser?.id === farm?.ownerId || currentUser?.role === 'ADMIN';

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const data = await farmService.getStaff(farm.id);
      setStaffList(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailToAssign.trim();
    if (!email) {
      setErrorMessage('Vui lòng nhập địa chỉ email/gmail cần phân công');
      return;
    }
    setAssigning(true);
    setErrorMessage(null);
    try {
      const user = await farmService.lookupStaff(email, roleToAssign);
      await farmService.assignStaff(farm.id, user.id);
      setEmailToAssign('');
      fetchStaff();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi gán thành viên');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (userId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn gỡ phân công của thành viên này khỏi trang trại?')) return;
    setErrorMessage(null);
    try {
      await farmService.unassignStaff(farm.id, userId);
      fetchStaff();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi gỡ phân công');
    }
  };

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
            className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-2xl shadow-2xl border border-white/60 overflow-hidden flex flex-col max-h-[90vh] transform transition-all animate-in zoom-in-95 duration-300"
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

              {/* Staff Management */}
              <div className="space-y-4 pt-6 border-t border-slate-100/50">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  Thành viên trang trại ({staffList.length})
                </h4>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
                    {errorMessage}
                  </div>
                )}

                {/* Form to Assign Staff by Email */}
                {isOwner && (
                  <form onSubmit={handleAssign} className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={roleToAssign}
                      onChange={(e) => setRoleToAssign(e.target.value as 'FARMER' | 'TECHNICIAN')}
                      className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="FARMER">🌱 Nông dân</option>
                      <option value="TECHNICIAN">🔬 Kỹ thuật viên</option>
                    </select>
                    <input
                      type="email"
                      value={emailToAssign}
                      onChange={(e) => {
                        setEmailToAssign(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Nhập Gmail đã đăng ký của nhân sự..."
                      className="flex-1 px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={assigning || !emailToAssign.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                    >
                      {assigning ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      Phân công
                    </button>
                  </form>
                )}

                {/* Staff List */}
                {loadingStaff ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                ) : staffList.length === 0 ? (
                  <p className="text-slate-400 text-xs font-medium italic text-center py-2">Chưa có thành viên nào được phân công.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {staffList.map((staff: any) => (
                      <div
                        key={staff.id}
                        className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl flex justify-between items-center group/staff"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50/80 text-blue-600 border border-blue-100/50 shadow-sm flex items-center justify-center font-bold text-xs uppercase">
                            {staff.user.fullName?.split(' ').pop()?.substring(0, 2) || 'TV'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{staff.user.fullName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                                staff.user.role === 'TECHNICIAN'
                                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              }`}>
                                {staff.user.role === 'TECHNICIAN' ? 'Kỹ thuật viên' : 'Nông dân'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">{staff.user.email}</span>
                            </div>
                          </div>
                        </div>

                        {isOwner && (
                          <button
                            onClick={() => handleUnassign(staff.userId)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl opacity-0 group-hover/staff:opacity-100 transition-all"
                            title="Gỡ khỏi trang trại"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
