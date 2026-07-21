import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Calendar,
  Waves,
  Edit2,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle2,
  Filter,
  RefreshCw,
  X,
  Users,
  Clock,
} from 'lucide-react';
import { farmService } from '../services/farm.service';
import { pondService } from '../services/pond.service';
import { cropService, type Crop } from '../services/crop.service';

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

const CROP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang nuôi',
  HARVESTED: 'Đã thu hoạch',
  FAILED: 'Thất thu',
};

const CROP_STATUS_BADGES: Record<string, { dot: string; bg: string }> = {
  ACTIVE: { dot: 'bg-emerald-500 animate-pulse', bg: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  HARVESTED: { dot: 'bg-blue-500', bg: 'border-blue-200 bg-blue-50 text-blue-700' },
  FAILED: { dot: 'bg-rose-500', bg: 'border-rose-200 bg-rose-50 text-rose-700' },
};

export default function CropManagement() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [filterFarmId, setFilterFarmId] = useState('');
  const [filterPondId, setFilterPondId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // ── Modal State ─────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingCropId, setEditingCropId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    farmId: '',
    pondId: '',
    startDate: new Date().toISOString().slice(0, 10),
    initialShrimpCount: '',
    status: 'ACTIVE',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Derived Data ─────────────────────────────────────────────────────────────
  const filterPondsList = filterFarmId
    ? ponds.filter((p) => p.farmId === filterFarmId)
    : ponds;

  const formPondsList = formData.farmId
    ? ponds.filter((p) => p.farmId === formData.farmId)
    : ponds;

  // ── Fetch Initial Data ───────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [farmsData, pondsData, cropsData] = await Promise.all([
        farmService.getAll(),
        pondService.getAll(),
        cropService.getAll({
          pondId: filterPondId || undefined,
          status: filterStatus || undefined,
        }),
      ]);
      setFarms(farmsData);
      setPonds(pondsData);
      setCrops(cropsData);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tải dữ liệu vụ nuôi', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterPondId, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtered Crops List ─────────────────────────────────────────────────────
  const filteredCrops = crops.filter((c) => {
    if (filterFarmId && c.pond?.farmId !== filterFarmId) return false;
    if (filterPondId && c.pondId !== filterPondId) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const pName = c.pond?.name?.toLowerCase() || '';
      const fName = c.pond?.farm?.name?.toLowerCase() || '';
      if (!pName.includes(q) && !fName.includes(q)) return false;
    }
    return true;
  });

  // ── Modal Handlers ──────────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingCropId(null);
    setFormData({
      farmId: farms.length > 0 ? farms[0].id : '',
      pondId: ponds.length > 0 ? ponds[0].id : '',
      startDate: new Date().toISOString().slice(0, 10),
      initialShrimpCount: '100000',
      status: 'ACTIVE',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (crop: Crop) => {
    setEditingCropId(crop.id);
    const dateStr = crop.startDate ? new Date(crop.startDate).toISOString().slice(0, 10) : '';
    setFormData({
      farmId: crop.pond?.farmId || '',
      pondId: crop.pondId,
      startDate: dateStr,
      initialShrimpCount: crop.initialShrimpCount.toString(),
      status: crop.status,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa vụ nuôi này?')) return;
    try {
      await cropService.remove(id);
      showToast('Xóa vụ nuôi thành công!', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Không thể xóa vụ nuôi', 'error');
    }
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.farmId) errs.farmId = 'Vui lòng chọn trang trại';
    if (!formData.pondId) errs.pondId = 'Vui lòng chọn ao nuôi';
    if (!formData.startDate) errs.startDate = 'Vui lòng chọn ngày thả';
    const cnt = parseInt(formData.initialShrimpCount, 10);
    if (!formData.initialShrimpCount || isNaN(cnt) || cnt <= 0) {
      errs.initialShrimpCount = 'Số lượng thả phải là số lớn hơn 0';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        pondId: formData.pondId,
        startDate: new Date(formData.startDate).toISOString(),
        initialShrimpCount: parseInt(formData.initialShrimpCount, 10),
        status: formData.status,
      };

      if (editingCropId) {
        await cropService.update(editingCropId, {
          startDate: payload.startDate,
          initialShrimpCount: payload.initialShrimpCount,
          status: payload.status,
        });
        showToast('Cập nhật vụ nuôi thành công!', 'success');
      } else {
        await cropService.create(payload);
        showToast('Tạo vụ nuôi mới thành công!', 'success');
      }

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lưu vụ nuôi', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper for computing Days in Culture (DOC)
  const getDOC = (startDateStr: string) => {
    const start = new Date(startDateStr).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  };

  return (
    <div className="relative z-10 max-w-6xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-right-8 fade-in duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* Header Actions - Blue Theme */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100/50">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500 tracking-tight">
              Quản Lý Vụ Nuôi
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Theo dõi lịch sử thả giống và chu kỳ nuôi tôm theo ao
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-2 text-sm font-semibold border border-slate-200"
            title="Tải lại"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Tạo vụ mới
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <Filter className="w-4 h-4" />
          Bộ lọc & Tìm kiếm
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Farm filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Trang trại</label>
            <select
              value={filterFarmId}
              onChange={(e) => {
                setFilterFarmId(e.target.value);
                setFilterPondId('');
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="">Tất cả trang trại</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Pond filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Ao nuôi</label>
            <select
              value={filterPondId}
              onChange={(e) => setFilterPondId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="">Tất cả ao nuôi</option>
              {filterPondsList.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang nuôi (ACTIVE)</option>
              <option value="HARVESTED">Đã thu hoạch (HARVESTED)</option>
              <option value="FAILED">Thất thu (FAILED)</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Tìm kiếm</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tên ao/trang trại..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Crop Card List */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 text-sm font-medium">Đang tải danh sách vụ nuôi...</p>
          </div>
        </div>
      ) : filteredCrops.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-slate-100 shadow-sm text-center px-6">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">Chưa có vụ nuôi nào</h3>
          <p className="text-slate-500 text-sm mb-4">
            Không tìm thấy vụ nuôi phù hợp với bộ lọc. Hãy tạo vụ nuôi mới.
          </p>
          <button
            onClick={openAddModal}
            className="text-blue-600 font-semibold text-sm hover:underline flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Tạo vụ nuôi ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCrops.map((crop) => {
            const statusBadge = CROP_STATUS_BADGES[crop.status] || CROP_STATUS_BADGES.ACTIVE;
            const doc = getDOC(crop.startDate);
            const startDateFormatted = new Date(crop.startDate).toLocaleDateString('vi-VN');

            return (
              <div
                key={crop.id}
                className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all hover:-translate-y-1.5 duration-500 group flex flex-col overflow-hidden relative p-6 gap-4"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <Waves className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{crop.pond?.name || 'Ao nuôi'}</h3>
                      <p className="text-xs font-semibold text-slate-400 uppercase">
                        {crop.pond?.farm?.name || 'Trang trại'}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border ${statusBadge.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                    {CROP_STATUS_LABELS[crop.status] || crop.status}
                  </span>
                </div>

                {/* Details Matrix */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 shadow-inner">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-500" />
                      Ngày thả giống
                    </span>
                    <span className="text-sm font-bold text-slate-800">{startDateFormatted}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-500" />
                      Thời gian nuôi
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {crop.status === 'ACTIVE' ? `Ngày ${doc} (DOC)` : 'Đã kết thúc'}
                    </span>
                  </div>

                  <div className="col-span-2 pt-2 border-t border-slate-200/50 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3 h-3 text-blue-500" />
                      Số tôm thả ban đầu
                    </span>
                    <span className="text-base font-black text-slate-800">
                      {crop.initialShrimpCount.toLocaleString()}{' '}
                      <span className="text-xs font-semibold text-slate-400">con</span>
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openEditModal(crop)}
                    className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-xl transition-colors text-xs font-bold flex items-center gap-1"
                    title="Chỉnh sửa / Cập nhật trạng thái"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, crop.id)}
                    className="p-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl transition-colors text-xs font-bold flex items-center gap-1"
                    title="Xóa vụ nuôi"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">
                {editingCropId ? 'Cập Nhật Vụ Nuôi' : 'Tạo Vụ Nuôi Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Farm */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Trang trại <span className="text-red-500">*</span>
                </label>
                <select
                  disabled={!!editingCropId}
                  value={formData.farmId}
                  onChange={(e) => {
                    setFormData({ ...formData, farmId: e.target.value, pondId: '' });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 transition-all disabled:opacity-60"
                >
                  <option value="" disabled>-- Chọn trang trại --</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {formErrors.farmId && (
                  <p className="text-xs text-red-600 font-medium mt-1">{formErrors.farmId}</p>
                )}
              </div>

              {/* Pond */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Ao nuôi <span className="text-red-500">*</span>
                </label>
                <select
                  disabled={!!editingCropId || !formData.farmId}
                  value={formData.pondId}
                  onChange={(e) => setFormData({ ...formData, pondId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 transition-all disabled:opacity-60"
                >
                  <option value="" disabled>-- Chọn ao nuôi --</option>
                  {formPondsList.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {formErrors.pondId && (
                  <p className="text-xs text-red-600 font-medium mt-1">{formErrors.pondId}</p>
                )}
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Ngày thả giống <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 transition-all"
                />
                {formErrors.startDate && (
                  <p className="text-xs text-red-600 font-medium mt-1">{formErrors.startDate}</p>
                )}
              </div>

              {/* Initial Shrimp Count */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Số lượng tôm thả (con) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="VD: 100000"
                  value={formData.initialShrimpCount}
                  onChange={(e) => setFormData({ ...formData, initialShrimpCount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 transition-all"
                />
                {formErrors.initialShrimpCount && (
                  <p className="text-xs text-red-600 font-medium mt-1">{formErrors.initialShrimpCount}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Trạng thái vụ nuôi <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-blue-500 transition-all"
                >
                  <option value="ACTIVE">Đang nuôi (ACTIVE)</option>
                  <option value="HARVESTED">Đã thu hoạch (HARVESTED)</option>
                  <option value="FAILED">Thất thu (FAILED)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang lưu...
                    </>
                  ) : editingCropId ? (
                    'Lưu Thay Đổi'
                  ) : (
                    'Tạo Vụ Nuôi'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
