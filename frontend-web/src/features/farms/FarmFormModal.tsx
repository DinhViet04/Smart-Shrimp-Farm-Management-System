import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Users, FlaskConical, UserCheck, Plus, Trash2 } from 'lucide-react';
import { farmService } from '../../services/farm.service';

const PROVINCES = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau", "Cần Thơ", "Cao Bằng", "Đà Nẵng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Nội", "Hà Tĩnh", "Hải Dương", "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "TP Hồ Chí Minh", "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
];

interface AssignedStaffMember {
  id: string;
  fullName: string;
  email: string;
  role: 'FARMER' | 'TECHNICIAN';
  phone?: string;
}

interface FarmFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  initialData?: any;
}

export default function FarmFormModal({ isOpen, onClose, onSuccess, initialData }: FarmFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    area: 0,
    description: '',
    status: 'ACTIVE',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Assigned staff state
  const [assignedStaff, setAssignedStaff] = useState<AssignedStaffMember[]>([]);

  // Email input & search state for Farmer
  const [farmerEmailInput, setFarmerEmailInput] = useState('');
  const [isSearchingFarmer, setIsSearchingFarmer] = useState(false);
  const [farmerSearchError, setFarmerSearchError] = useState<string | null>(null);

  // Email input & search state for Technician
  const [techEmailInput, setTechEmailInput] = useState('');
  const [isSearchingTech, setIsSearchingTech] = useState(false);
  const [techSearchError, setTechSearchError] = useState<string | null>(null);

  // Load user from local storage to get ownerId
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        address: initialData.address || '',
        area: initialData.area || 0,
        description: initialData.description || '',
        status: initialData.status || 'ACTIVE',
      });
    } else {
      setFormData({
        name: '',
        address: '',
        area: 0,
        description: '',
        status: 'ACTIVE',
      });
      setAssignedStaff([]);
    }
    setError(null);
    setFarmerEmailInput('');
    setTechEmailInput('');
    setFarmerSearchError(null);
    setTechSearchError(null);
  }, [initialData, isOpen]);

  // Fetch current staff when editing
  useEffect(() => {
    const loadCurrentStaff = async () => {
      if (initialData && isOpen) {
        try {
          const staff = await farmService.getStaff(initialData.id);
          setAssignedStaff(
            staff.map((s: any) => ({
              id: s.user?.id || s.userId,
              fullName: s.user?.fullName || 'Thành viên',
              email: s.user?.email || '',
              role: s.user?.role || s.role,
              phone: s.user?.phone,
            }))
          );
        } catch (e) {
          console.error("Failed to load farm staff", e);
        }
      }
    };

    if (isOpen) {
      loadCurrentStaff();
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'area' ? parseFloat(value) || 0 : value 
    }));
  };

  const handleAddFarmer = async () => {
    setFarmerSearchError(null);
    const email = farmerEmailInput.trim();
    if (!email) {
      setFarmerSearchError('Vui lòng nhập địa chỉ email/gmail của Nông dân.');
      return;
    }
    if (assignedStaff.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      setFarmerSearchError('Nông dân này đã có trong danh sách phân công.');
      return;
    }
    setIsSearchingFarmer(true);
    try {
      const result = await farmService.lookupStaff(email, 'FARMER');
      setAssignedStaff(prev => [
        ...prev,
        {
          id: result.id,
          fullName: result.fullName,
          email: result.email,
          role: 'FARMER',
          phone: result.phone,
        },
      ]);
      setFarmerEmailInput('');
    } catch (err: any) {
      setFarmerSearchError(err.message || 'Không tìm thấy tài khoản Nông dân với email này.');
    } finally {
      setIsSearchingFarmer(false);
    }
  };

  const handleAddTech = async () => {
    setTechSearchError(null);
    const email = techEmailInput.trim();
    if (!email) {
      setTechSearchError('Vui lòng nhập địa chỉ email/gmail của Kỹ thuật viên.');
      return;
    }
    if (assignedStaff.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      setTechSearchError('Kỹ thuật viên này đã có trong danh sách phân công.');
      return;
    }
    setIsSearchingTech(true);
    try {
      const result = await farmService.lookupStaff(email, 'TECHNICIAN');
      setAssignedStaff(prev => [
        ...prev,
        {
          id: result.id,
          fullName: result.fullName,
          email: result.email,
          role: 'TECHNICIAN',
          phone: result.phone,
        },
      ]);
      setTechEmailInput('');
    } catch (err: any) {
      setTechSearchError(err.message || 'Không tìm thấy tài khoản Kỹ thuật viên với email này.');
    } finally {
      setIsSearchingTech(false);
    }
  };

  const handleRemoveStaff = (id: string) => {
    setAssignedStaff(prev => prev.filter(s => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload = {
        ...formData,
        staffIds: assignedStaff.map(s => s.id),
      };

      if (initialData) {
        await farmService.update(initialData.id, payload);
        onSuccess('Cập nhật trang trại thành công!');
      } else {
        await farmService.create({ ...payload, ownerId: user.id });
        onSuccess('Thêm trang trại mới thành công!');
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
                  step="0.01"
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 bg-slate-50/50 focus:bg-white"
                  placeholder="0.00"
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
                  Phân công nhân sự theo Gmail đã đăng ký
                </label>
                <span className="text-[11px] font-semibold text-slate-500">
                  Tổng nhân sự đã thêm: <strong className="text-blue-600">{assignedStaff.length}</strong>
                </span>
              </div>

              {/* ── Luồng 1: Phân công Nông Dân (Farmer) ── */}
              <div className="p-3 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      1. Thêm Nông Dân (Farmer)
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
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFarmer();
                      }
                    }}
                    placeholder="Nhập Gmail tài khoản Nông dân (VD: farmer@gmail.com)..."
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
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Thêm Nông Dân
                  </button>
                </div>

                {farmerSearchError && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold rounded-xl flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{farmerSearchError}</span>
                  </div>
                )}

                {/* List of Added Farmers */}
                {farmers.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    Chưa có Nông dân nào được thêm vào trang trại này.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto p-0.5">
                    {farmers.map((farmer) => (
                      <div
                        key={farmer.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-emerald-200 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{farmer.fullName}</p>
                          <span className="text-[10px] text-slate-500 truncate block">{farmer.email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(farmer.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Gỡ khỏi danh sách"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                      2. Thêm Kỹ Thuật Viên (Technician)
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
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTech();
                      }
                    }}
                    placeholder="Nhập Gmail tài khoản Kỹ thuật viên (VD: tech@gmail.com)..."
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
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Thêm Kỹ Thuật Viên
                  </button>
                </div>

                {techSearchError && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold rounded-xl flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{techSearchError}</span>
                  </div>
                )}

                {/* List of Added Technicians */}
                {technicians.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    Chưa có Kỹ thuật viên nào được thêm vào trang trại này.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto p-0.5">
                    {technicians.map((tech) => (
                      <div
                        key={tech.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-cyan-200 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{tech.fullName}</p>
                          <span className="text-[10px] text-slate-500 truncate block">{tech.email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(tech.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Gỡ khỏi danh sách"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
}
