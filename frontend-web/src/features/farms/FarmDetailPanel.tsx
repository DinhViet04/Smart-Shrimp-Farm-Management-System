import { useState, useEffect } from 'react';
import { X, MapPin, Maximize, Calendar, Activity, Building2, Waves, Eye, Users, UserPlus, Trash2, Cpu, UserCheck, FlaskConical, AlertCircle, CheckCircle } from 'lucide-react';
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
  const [farmerEmailToAssign, setFarmerEmailToAssign] = useState('');
  const [techEmailToAssign, setTechEmailToAssign] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [assigningRole, setAssigningRole] = useState<'FARMER' | 'TECHNICIAN' | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [staffToUnassign, setStaffToUnassign] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
      setFarmerEmailToAssign('');
      setTechEmailToAssign('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setStaffToUnassign(null);
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

  const getStaffRole = (staff: any): 'TECHNICIAN' | 'FARMER' => {
    const farmRole = (staff.role || '').toUpperCase();
    if (farmRole === 'TECHNICIAN') return 'TECHNICIAN';
    if (farmRole === 'FARMER') return 'FARMER';
    const userRole = (staff.user?.role || '').toUpperCase();
    if (userRole === 'TECHNICIAN') return 'TECHNICIAN';
    return 'FARMER';
  };

  const farmers = staffList.filter((s: any) => getStaffRole(s) === 'FARMER');
  const technicians = staffList.filter((s: any) => getStaffRole(s) === 'TECHNICIAN');

  const handleAssignByRole = async (e: React.FormEvent, role: 'FARMER' | 'TECHNICIAN') => {
    e.preventDefault();
    const email = (role === 'FARMER' ? farmerEmailToAssign : techEmailToAssign).trim();
    if (!email) {
      setErrorMessage(`Vui lòng nhập địa chỉ email của ${role === 'FARMER' ? 'Nông dân' : 'Kỹ thuật viên'}`);
      return;
    }
    setAssigningRole(role);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await farmService.inviteByEmail(farm.id, email, role);
      if (role === 'FARMER') setFarmerEmailToAssign('');
      else setTechEmailToAssign('');

      if (res.status === 'assigned') {
        setSuccessMessage(`✅ Đã thêm ${role === 'FARMER' ? 'Nông dân' : 'Kỹ thuật viên'} (${res.email}) vào trang trại`);
      } else {
        setSuccessMessage(`📧 Đã gửi email mời tới ${res.email}`);
      }
      fetchStaff();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi phân công nhân sự');
    } finally {
      setAssigningRole(null);
    }
  };

  const confirmUnassign = async () => {
    if (!staffToUnassign) return;
    const userId = staffToUnassign.userId || staffToUnassign.id;
    setErrorMessage(null);
    setSuccessMessage(null);
    setUnassigningId(userId);
    try {
      await farmService.unassignStaff(farm.id, userId);
      const name = staffToUnassign.user?.fullName || staffToUnassign.user?.email || 'thành viên';
      setSuccessMessage(`Đã gỡ ${name} khỏi trang trại thành công.`);
      setStaffToUnassign(null);
      fetchStaff();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi gỡ phân công');
    } finally {
      setUnassigningId(null);
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 flex flex-col gap-1 items-start shadow-inner">
                  <div className="flex items-center gap-1.5 text-indigo-600/80 text-xs font-bold uppercase tracking-wider">
                    <Cpu className="w-4 h-4" />
                    Mô hình nuôi
                  </div>
                  <p className="text-sm font-black text-indigo-900 mt-1">
                    {farm.farmingModel === 'TRADITIONAL' ? 'Truyền thống' : 'Công nghệ cao'}
                  </p>
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

              {/* Staff Management - Tách thành 2 mục Farmer và Technician giống khi tạo/sửa */}
              <div className="space-y-4 pt-6 border-t border-slate-100/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Thành viên trang trại ({staffList.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {farmers.length} Nông dân
                    </span>
                    <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-200">
                      {technicians.length} Kỹ thuật viên
                    </span>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* ── MỤC 1: NÔNG DÂN (FARMER) ── */}
                <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                        1. Nông Dân (Farmer)
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      farmers.length > 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {farmers.length} thành viên
                    </span>
                  </div>

                  {/* Form phân công Nông dân (chỉ chủ trại/admin) */}
                  {isOwner && (
                    <form onSubmit={(e) => handleAssignByRole(e, 'FARMER')} className="flex gap-2">
                      <input
                        type="email"
                        value={farmerEmailToAssign}
                        onChange={(e) => {
                          setFarmerEmailToAssign(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Nhập Gmail phân công Nông dân..."
                        className="flex-1 px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={assigningRole === 'FARMER' || !farmerEmailToAssign.trim()}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                      >
                        {assigningRole === 'FARMER' ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        Thêm Nông Dân
                      </button>
                    </form>
                  )}

                  {/* Danh sách Nông dân */}
                  {loadingStaff ? (
                    <div className="flex items-center justify-center py-3 gap-2 text-slate-400 text-xs">
                      <div className="w-4 h-4 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                      <span>Đang tải danh sách Nông dân...</span>
                    </div>
                  ) : farmers.length === 0 ? (
                    <p className="text-slate-400 text-xs font-medium italic py-1">Chưa có Nông dân nào được phân công.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {farmers.map((staff: any) => (
                        <div
                          key={staff.id}
                          className="p-2.5 bg-white border border-emerald-200/80 rounded-xl flex justify-between items-center shadow-sm group/staff"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                              {staff.user?.fullName?.split(' ').pop()?.substring(0, 2) || 'ND'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{staff.user?.fullName || staff.user?.email || 'Nông dân'}</p>
                              <span className="text-[10px] text-slate-500 truncate block">{staff.user?.email}</span>
                            </div>
                          </div>

                          {isOwner && (
                            <button
                              onClick={() => setStaffToUnassign(staff)}
                              disabled={unassigningId === staff.userId}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-1 flex-shrink-0 cursor-pointer disabled:opacity-50"
                              title="Gỡ khỏi trang trại"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── MỤC 2: KỸ THUẬT VIÊN (TECHNICIAN) ── */}
                <div className="p-4 bg-cyan-50/40 rounded-2xl border border-cyan-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-cyan-600" />
                      <span className="text-xs font-bold text-cyan-950 uppercase tracking-wider">
                        2. Kỹ Thuật Viên (Technician)
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      technicians.length > 0 ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700'
                    }`}>
                      {technicians.length} thành viên
                    </span>
                  </div>

                  {/* Form phân công Kỹ thuật viên (chỉ chủ trại/admin) */}
                  {isOwner && (
                    <form onSubmit={(e) => handleAssignByRole(e, 'TECHNICIAN')} className="flex gap-2">
                      <input
                        type="email"
                        value={techEmailToAssign}
                        onChange={(e) => {
                          setTechEmailToAssign(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Nhập Gmail phân công Kỹ thuật viên..."
                        className="flex-1 px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={assigningRole === 'TECHNICIAN' || !techEmailToAssign.trim()}
                        className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                      >
                        {assigningRole === 'TECHNICIAN' ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        Thêm Kỹ Thuật Viên
                      </button>
                    </form>
                  )}

                  {/* Danh sách Kỹ thuật viên */}
                  {loadingStaff ? (
                    <div className="flex items-center justify-center py-3 gap-2 text-slate-400 text-xs">
                      <div className="w-4 h-4 border-2 border-slate-200 border-t-cyan-600 rounded-full animate-spin" />
                      <span>Đang tải danh sách Kỹ thuật viên...</span>
                    </div>
                  ) : technicians.length === 0 ? (
                    <p className="text-slate-400 text-xs font-medium italic py-1">Chưa có Kỹ thuật viên nào được phân công.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {technicians.map((staff: any) => (
                        <div
                          key={staff.id}
                          className="p-2.5 bg-white border border-cyan-200/80 rounded-xl flex justify-between items-center shadow-sm group/staff"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 border border-cyan-200 shadow-sm flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                              {staff.user?.fullName?.split(' ').pop()?.substring(0, 2) || 'KT'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{staff.user?.fullName || staff.user?.email || 'Kỹ thuật viên'}</p>
                              <span className="text-[10px] text-slate-500 truncate block">{staff.user?.email}</span>
                            </div>
                          </div>

                          {isOwner && (
                            <button
                              onClick={() => setStaffToUnassign(staff)}
                              disabled={unassigningId === staff.userId}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-1 flex-shrink-0 cursor-pointer disabled:opacity-50"
                              title="Gỡ khỏi trang trại"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

      {/* Modal Xác Nhận Gỡ Nhân Sự Khỏi Trang Trại */}
      {staffToUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner border border-red-100">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">
              Xác nhận gỡ nhân sự
            </h3>
            <p className="text-slate-600 text-xs mb-4 leading-relaxed">
              Bạn có chắc chắn muốn gỡ{' '}
              <span className="font-bold text-slate-900">
                {staffToUnassign.user?.fullName || staffToUnassign.user?.email || 'thành viên này'}
              </span>{' '}
              khỏi trang trại <span className="font-bold text-blue-700">{farm.name}</span> không?
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-[11px] text-amber-800 font-medium mb-5 text-left flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                Sau khi gỡ, nhân sự này sẽ không còn quyền truy cập dữ liệu và nhật ký của trang trại.
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStaffToUnassign(null)}
                disabled={unassigningId === (staffToUnassign.userId || staffToUnassign.id)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmUnassign}
                disabled={unassigningId === (staffToUnassign.userId || staffToUnassign.id)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-md shadow-red-500/20 text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {unassigningId === (staffToUnassign.userId || staffToUnassign.id) ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Gỡ ngay</span>
                  </>
                )}
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
