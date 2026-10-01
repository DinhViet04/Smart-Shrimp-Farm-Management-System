import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Users, FlaskConical, UserCheck, Trash2, Mail, CheckCircle, Clock } from 'lucide-react';
import { farmService } from '../../services/farm.service';

const PROVINCES = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau", "Cần Thơ", "Cao Bằng", "Đà Nẵng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Nội", "Hà Tĩnh", "Hải Dương", "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "TP Hồ Chí Minh", "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
];

interface AssignedStaffMember {
  id?: string;          // undefined nếu user chưa có tài khoản
  fullName?: string;
  email: string;
  role: 'FARMER' | 'TECHNICIAN';
  phone?: string;
  status: 'assigned' | 'invited'; // 'assigned' = đã có TK & đã join, 'invited' = chờ đăng ký
}

interface FarmFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string, createdFarmId?: string) => void;
  initialData?: any;
}

export default function FarmFormModal({ isOpen, onClose, onSuccess, initialData }: FarmFormModalProps) {
  const [formData, setFormData] = useState<{
    name: string;
    address: string;
    area: number | string;
    description: string;
    status: string;
    farmingModel: string;
  }>({
    name: '',
    address: '',
    area: '',
    description: '',
    status: 'ACTIVE',
    farmingModel: 'HIGH_TECH',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Assigned staff state
  const [assignedStaff, setAssignedStaff] = useState<AssignedStaffMember[]>([]);
  // Pending invites khi tạo farm mới (farm chưa có id)
  const [pendingInvites, setPendingInvites] = useState<{ email: string; role: 'FARMER' | 'TECHNICIAN' }[]>([]);

  // Email input & search state for Farmer
  const [farmerEmailInput, setFarmerEmailInput] = useState('');
  const [isSearchingFarmer, setIsSearchingFarmer] = useState(false);
  const [farmerSearchError, setFarmerSearchError] = useState<string | null>(null);
  const [farmerSearchSuccess, setFarmerSearchSuccess] = useState<string | null>(null);

  // Email input & search state for Technician
  const [techEmailInput, setTechEmailInput] = useState('');
  const [isSearchingTech, setIsSearchingTech] = useState(false);
  const [techSearchError, setTechSearchError] = useState<string | null>(null);
  const [techSearchSuccess, setTechSearchSuccess] = useState<string | null>(null);

  // Load user from local storage to get ownerId
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [loadingStaff, setLoadingStaff] = useState(false);
  const [removingStaffEmail, setRemovingStaffEmail] = useState<string | null>(null);
  const [staffToUnassign, setStaffToUnassign] = useState<AssignedStaffMember | null>(null);

  const resolveStaffRole = (s: any): 'FARMER' | 'TECHNICIAN' => {
    // 1. Ưu tiên vai trò phân công trong trang trại (FarmStaff.role)
    const farmRole = (s.role || '').toUpperCase();
    if (farmRole === 'TECHNICIAN') return 'TECHNICIAN';
    if (farmRole === 'FARMER') return 'FARMER';

    // 2. Vai trò của tài khoản người dùng (User.role)
    const userRole = (s.user?.role || '').toUpperCase();
    if (userRole === 'TECHNICIAN') return 'TECHNICIAN';

    // 3. Mặc định là FARMER
    return 'FARMER';
  };

  // Fetch current staff when editing
  const loadCurrentStaff = async (farmId?: string) => {
    const id = farmId || initialData?.id;
    if (id) {
      setLoadingStaff(true);
      try {
        const staff = await farmService.getStaff(id);
        setAssignedStaff(
          staff.map((s: any) => ({
            id: s.user?.id || s.userId,
            fullName: s.user?.fullName || 'Thành viên',
            email: s.user?.email || '',
            role: resolveStaffRole(s),
            phone: s.user?.phone,
            status: 'assigned' as const,
          }))
        );
      } catch (e) {
        console.error("Failed to load farm staff", e);
      } finally {
        setLoadingStaff(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setAssignedStaff([]);
      setPendingInvites([]);
      setFarmerEmailInput('');
      setTechEmailInput('');
      setFarmerSearchError(null);
      setFarmerSearchSuccess(null);
      setTechSearchError(null);
      setTechSearchSuccess(null);
      setError(null);
      setStaffToUnassign(null);
      return;
    }

    if (initialData?.id) {
      setFormData({
        name: initialData.name || '',
        address: initialData.address || '',
        area: initialData.area !== undefined && initialData.area !== null ? initialData.area : '',
        description: initialData.description || '',
        status: initialData.status || 'ACTIVE',
        farmingModel: initialData.farmingModel || 'HIGH_TECH',
      });
      loadCurrentStaff(initialData.id);
    } else {
      setFormData({
        name: '',
        address: '',
        area: '',
        description: '',
        status: 'ACTIVE',
        farmingModel: 'HIGH_TECH',
      });
      setAssignedStaff([]);
      setPendingInvites([]);
    }
    setError(null);
    setFarmerEmailInput('');
    setTechEmailInput('');
    setFarmerSearchError(null);
    setFarmerSearchSuccess(null);
    setTechSearchError(null);
    setTechSearchSuccess(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: value 
    }));
  };

  const handleAddFarmer = async () => {
    setFarmerSearchError(null);
    setFarmerSearchSuccess(null);
    const email = farmerEmailInput.trim();
    if (!email) {
      setFarmerSearchError('Vui lòng nhập địa chỉ email của Nông dân.');
      return;
    }
    const alreadyInList = assignedStaff.some(s => s.email.toLowerCase() === email.toLowerCase())
      || pendingInvites.some(p => p.email.toLowerCase() === email.toLowerCase() && p.role === 'FARMER');
    if (alreadyInList) {
      setFarmerSearchError('Email này đã có trong danh sách.');
      return;
    }
    setIsSearchingFarmer(true);
    try {
      if (initialData?.id) {
        // Đang edit farm → gọi API invite ngay
        const result = await farmService.inviteByEmail(initialData.id, email, 'FARMER');
        await loadCurrentStaff();
        if (result.status === 'assigned') {
          setFarmerSearchSuccess(`✅ Đã thêm và gửi email thông báo tới ${result.email}`);
        } else {
          setFarmerSearchSuccess(`📧 Đã gửi email mời đăng ký tới ${result.email}`);
        }
      } else {
        // Đang tạo farm mới → queue lại, sẽ gửi sau khi farm được tạo
        setPendingInvites(prev => [...prev, { email, role: 'FARMER' }]);
        setAssignedStaff(prev => [
          ...prev,
          { email, role: 'FARMER', status: 'invited' },
        ]);
        setFarmerSearchSuccess(`📧 Đã thêm vào danh sách — email mời sẽ được gửi sau khi tạo trang trại.`);
      }
      setFarmerEmailInput('');
    } catch (err: any) {
      setFarmerSearchError(err.message || 'Không thể thêm Nông dân.');
    } finally {
      setIsSearchingFarmer(false);
    }
  };

  const handleAddTech = async () => {
    setTechSearchError(null);
    setTechSearchSuccess(null);
    const email = techEmailInput.trim();
    if (!email) {
      setTechSearchError('Vui lòng nhập địa chỉ email của Kỹ thuật viên.');
      return;
    }
    const alreadyInList = assignedStaff.some(s => s.email.toLowerCase() === email.toLowerCase())
      || pendingInvites.some(p => p.email.toLowerCase() === email.toLowerCase() && p.role === 'TECHNICIAN');
    if (alreadyInList) {
      setTechSearchError('Email này đã có trong danh sách.');
      return;
    }
    setIsSearchingTech(true);
    try {
      if (initialData?.id) {
        // Đang edit farm → gọi API invite ngay
        const result = await farmService.inviteByEmail(initialData.id, email, 'TECHNICIAN');
        await loadCurrentStaff();
        if (result.status === 'assigned') {
          setTechSearchSuccess(`✅ Đã thêm và gửi email thông báo tới ${result.email}`);
        } else {
          setTechSearchSuccess(`📧 Đã gửi email mời đăng ký tới ${result.email}`);
        }
      } else {
        // Đang tạo farm mới → queue lại
        setPendingInvites(prev => [...prev, { email, role: 'TECHNICIAN' }]);
        setAssignedStaff(prev => [
          ...prev,
          { email, role: 'TECHNICIAN', status: 'invited' },
        ]);
        setTechSearchSuccess(`📧 Đã thêm vào danh sách — email mời sẽ được gửi sau khi tạo trang trại.`);
      }
      setTechEmailInput('');
    } catch (err: any) {
      setTechSearchError(err.message || 'Không thể thêm Kỹ thuật viên.');
    } finally {
      setIsSearchingTech(false);
    }
  };

  const handleRemoveStaff = (staffMember: AssignedStaffMember) => {
    const isEditing = !!initialData?.id;
    const isJoined = staffMember.status === 'assigned' && !!staffMember.id;

    if (isEditing && isJoined) {
      setStaffToUnassign(staffMember);
    } else {
      // Đang tạo farm mới hoặc pending invite
      setAssignedStaff(prev => prev.filter(s => s.email !== staffMember.email));
      setPendingInvites(prev => prev.filter(p => p.email !== staffMember.email));
    }
  };

  const confirmUnassignStaff = async () => {
    if (!staffToUnassign || !initialData?.id || !staffToUnassign.id) return;
    setRemovingStaffEmail(staffToUnassign.email);
    setError(null);
    try {
      await farmService.unassignStaff(initialData.id, staffToUnassign.id);
      await loadCurrentStaff();
      setStaffToUnassign(null);
    } catch (err: any) {
      setError(err.message || 'Không thể gỡ phân công nhân sự này.');
    } finally {
      setRemovingStaffEmail(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedArea = parseFloat(String(formData.area));
    if (isNaN(parsedArea) || parsedArea <= 0) {
      setError('Vui lòng nhập diện tích trang trại hợp lệ (lớn hơn 0 m²).');
      return;
    }

    setIsLoading(true);

    try {
      const submitData = {
        ...formData,
        area: parsedArea,
      };

      if (initialData) {
        await farmService.update(initialData.id, submitData);
        onSuccess('Cập nhật trang trại thành công!');
      } else {
        // Tạo farm trước
        const ownerId = user?.id || user?.userId || user?.sub;
        const newFarm = await farmService.create({ ...submitData, ...(ownerId && { ownerId }) });
        // Gửi invite cho tất cả pending sau khi có farmId
        if (pendingInvites.length > 0 && newFarm?.id) {
          await Promise.allSettled(
            pendingInvites.map(invite =>
              farmService.inviteByEmail(newFarm.id, invite.email, invite.role)
            )
          );
        }
        onSuccess('Thêm trang trại mới thành công!', newFarm?.id);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const farmers = assignedStaff.filter(s => s.role === 'FARMER');
  const technicians = assignedStaff.filter(s => s.role === 'TECHNICIAN');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">
                {initialData ? 'Chỉnh Sửa Trang Trại' : 'Thêm Trang Trại Mới'}
              </h2>
              <p className="text-[11px] text-slate-500">Khai báo thông tin trang trại và thêm nhân sự theo đúng Gmail đăng ký</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-xs font-semibold border border-red-100 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form id="farm-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Grid 1: Name & Province */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tên Trang Trại <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 bg-slate-50/50 focus:bg-white"
                  placeholder="VD: Trại Bạc Liêu 1"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tỉnh/Thành phố <span className="text-red-500">*</span></label>
                <select
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 bg-slate-50/50 focus:bg-white"
                >
                  <option value="" disabled>-- Chọn Tỉnh/Thành phố --</option>
                  {PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid 2: Area & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Diện Tích (m²) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  min="0"
                  step="any"
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 bg-slate-50/50 focus:bg-white"
                  placeholder="VD: 5000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Trạng Thái</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 bg-slate-50/50 focus:bg-white"
                >
                  <option value="ACTIVE">Hoạt động (Active)</option>
                  <option value="INACTIVE">Tạm ngưng (Inactive)</option>
                </select>
              </div>
            </div>

            {/* Mô hình nuôi tôm */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                Mô hình nuôi tôm <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mô hình truyền thống */}
                <label
                  className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.farmingModel === 'TRADITIONAL'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/10'
                      : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="farmingModel"
                      value="TRADITIONAL"
                      checked={formData.farmingModel === 'TRADITIONAL'}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Mô hình truyền thống
                    </span>
                  </div>
                </label>

                {/* Mô hình công nghệ cao */}
                <label
                  className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.farmingModel === 'HIGH_TECH'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/10'
                      : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="farmingModel"
                      value="HIGH_TECH"
                      checked={formData.farmingModel === 'HIGH_TECH'}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Mô hình công nghệ cao
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200">
                    Khuyên dùng
                  </span>
                </label>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Mô Tả</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 resize-none bg-slate-50/50 focus:bg-white"
                placeholder="Nhập mô tả thêm (không bắt buộc)"
              ></textarea>
            </div>

            {/* Phân công thành viên - 2 luồng nhập Gmail chuẩn xác */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  {initialData ? 'Quản lý nhân sự theo Gmail đã đăng ký' : 'Phân công nhân sự theo Gmail đã đăng ký'}
                </label>
                <span className="text-[11px] font-semibold text-slate-500">
                  Tổng nhân sự: <strong className="text-blue-600">{assignedStaff.length}</strong>
                </span>
              </div>

              {/* ── Luồng 1: Phân công Nông Dân (Farmer) ── */}
              <div className="p-3 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      1. Nông Dân (Farmer)
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    farmers.length > 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    Đã thêm: {farmers.length}
                  </span>
                </div>

                {/* Input Email for Farmer */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={farmerEmailInput}
                    onChange={(e) => {
                      setFarmerEmailInput(e.target.value);
                      if (farmerSearchError) setFarmerSearchError(null);
                      if (farmerSearchSuccess) setFarmerSearchSuccess(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFarmer();
                      }
                    }}
                    placeholder="Nhập email Nông dân (đã có TK hoặc chưa)..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddFarmer}
                    disabled={isSearchingFarmer || !farmerEmailInput.trim()}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex-shrink-0 cursor-pointer"
                  >
                    {isSearchingFarmer ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    Mời Nông Dân
                  </button>
                </div>

                {farmerSearchError && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold rounded-xl flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{farmerSearchError}</span>
                  </div>
                )}
                {farmerSearchSuccess && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold rounded-xl flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{farmerSearchSuccess}</span>
                  </div>
                )}

                {/* List of Added Farmers */}
                {loadingStaff ? (
                  <div className="flex items-center justify-center py-3 gap-2 text-slate-400 text-xs">
                    <div className="w-4 h-4 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                    <span>Đang tải danh sách Nông dân...</span>
                  </div>
                ) : farmers.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    Chưa có Nông dân nào được thêm. Nhập email để mời.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto p-0.5">
                    {farmers.map((farmer) => (
                      <div
                        key={farmer.email}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-emerald-200 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {farmer.fullName || farmer.email}
                          </p>
                          <span className="text-[10px] text-slate-500 truncate block">{farmer.email}</span>
                          {/* Status badge */}
                          {farmer.status === 'assigned' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full mt-0.5">
                              <CheckCircle className="w-2.5 h-2.5" /> Đã tham gia
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full mt-0.5">
                              <Clock className="w-2.5 h-2.5" /> Chờ đăng ký
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={removingStaffEmail === farmer.email}
                          onClick={() => handleRemoveStaff(farmer)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Gỡ khỏi trang trại"
                        >
                          {removingStaffEmail === farmer.email ? (
                            <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Luồng 2: Phân công Kỹ Thuật Viên (Technician) ── */}
              <div className="p-3 bg-cyan-50/40 rounded-2xl border border-cyan-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-3.5 h-3.5 text-cyan-600" />
                    <span className="text-xs font-bold text-cyan-950 uppercase tracking-wider">
                      2. Kỹ Thuật Viên (Technician)
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    technicians.length > 0 ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700'
                  }`}>
                    Đã thêm: {technicians.length}
                  </span>
                </div>

                {/* Input Email for Technician */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={techEmailInput}
                    onChange={(e) => {
                      setTechEmailInput(e.target.value);
                      if (techSearchError) setTechSearchError(null);
                      if (techSearchSuccess) setTechSearchSuccess(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTech();
                      }
                    }}
                    placeholder="Nhập email Kỹ thuật viên (đã có TK hoặc chưa)..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddTech}
                    disabled={isSearchingTech || !techEmailInput.trim()}
                    className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex-shrink-0 cursor-pointer"
                  >
                    {isSearchingTech ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    Mời Kỹ Thuật Viên
                  </button>
                </div>

                {techSearchError && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold rounded-xl flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{techSearchError}</span>
                  </div>
                )}
                {techSearchSuccess && (
                  <div className="p-2 bg-cyan-50 border border-cyan-200 text-cyan-700 text-[11px] font-semibold rounded-xl flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{techSearchSuccess}</span>
                  </div>
                )}

                {/* List of Added Technicians */}
                {loadingStaff ? (
                  <div className="flex items-center justify-center py-3 gap-2 text-slate-400 text-xs">
                    <div className="w-4 h-4 border-2 border-slate-200 border-t-cyan-600 rounded-full animate-spin" />
                    <span>Đang tải danh sách Kỹ thuật viên...</span>
                  </div>
                ) : technicians.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    Chưa có Kỹ thuật viên nào được thêm. Nhập email để mời.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto p-0.5">
                    {technicians.map((tech) => (
                      <div
                        key={tech.email}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-cyan-200 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {tech.fullName || tech.email}
                          </p>
                          <span className="text-[10px] text-slate-500 truncate block">{tech.email}</span>
                          {tech.status === 'assigned' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded-full mt-0.5">
                              <CheckCircle className="w-2.5 h-2.5" /> Đã tham gia
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full mt-0.5">
                              <Clock className="w-2.5 h-2.5" /> Chờ đăng ký
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={removingStaffEmail === tech.email}
                          onClick={() => handleRemoveStaff(tech)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Gỡ khỏi trang trại"
                        >
                          {removingStaffEmail === tech.email ? (
                            <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            form="farm-form"
            type="submit"
            disabled={isLoading}
            className={`px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-md shadow-blue-500/10 cursor-pointer ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {initialData ? 'Cập Nhật' : 'Lưu Trang Trại'}
          </button>
        </div>
      </div>

      {/* Modal Xác Nhận Gỡ Nhân Sự Khỏi Trang Trại */}
      {staffToUnassign && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                {staffToUnassign.fullName || staffToUnassign.email}
              </span>{' '}
              ({staffToUnassign.role === 'TECHNICIAN' ? 'Kỹ thuật viên' : 'Nông dân'}) khỏi trang trại{' '}
              <span className="font-bold text-blue-700">{initialData?.name || 'này'}</span> không?
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
                disabled={removingStaffEmail === staffToUnassign.email}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmUnassignStaff}
                disabled={removingStaffEmail === staffToUnassign.email}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-md shadow-red-500/20 text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {removingStaffEmail === staffToUnassign.email ? (
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
    </div>
  );
}
