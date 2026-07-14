import { useState, useEffect } from 'react';
import { Plus, Map, Waves, Edit2, Trash2, Eye, Search, AlertCircle, CheckCircle2, Maximize } from 'lucide-react';
import PondDetailPanel from './PondDetailPanel';

export default function PondManagement() {
  const [ponds, setPonds] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPond, setEditingPond] = useState<string | null>(null);
  const [viewingPond, setViewingPond] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    areaSize: '',
    depth: '',
    farmId: '',
  });
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredPonds = ponds.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Farms (sử dụng service chung)
      const { farmService } = await import('../services/farm.service');
      try {
        const farmsData = await farmService.getMy();
        setFarms(farmsData);
        if (farmsData.length > 0) {
          setFormData(prev => ({ ...prev, farmId: farmsData[0].id }));
        }
      } catch (err) {
        console.error('Lỗi khi lấy trang trại:', err);
      }

      // Fetch Ponds
      const { pondService } = await import('../services/pond.service');
      const pondsData = await pondService.getAll();
      setPonds(pondsData);
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingPond(null);
    setFormData({ name: '', areaSize: '', depth: '', farmId: farms.length > 0 ? farms[0].id : '' });
    setShowModal(true);
  };

  const openEditModal = (pond: any) => {
    setEditingPond(pond.id);
    setFormData({
      name: pond.name,
      areaSize: pond.areaSize.toString(),
      depth: pond.depth.toString(),
      farmId: pond.farmId,
    });
    setShowModal(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa ao này?')) return;
    try {
      const { pondService } = await import('../services/pond.service');
      await pondService.remove(id);
      showToast('Xóa ao nuôi thành công!', 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.message || 'Lỗi khi xóa ao nuôi', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { pondService } = await import('../services/pond.service');
      const data = {
        name: formData.name,
        areaSize: Number(formData.areaSize),
        depth: Number(formData.depth),
        farmId: formData.farmId,
      };

      if (editingPond) {
        await pondService.update(editingPond, data);
        showToast('Cập nhật ao nuôi thành công!', 'success');
      } else {
        await pondService.create(data);
        showToast('Thêm ao nuôi mới thành công!', 'success');
      }
      
      setShowModal(false);
      fetchData(); // Reload list
    } catch (error: any) {
      showToast(error.message || 'Không thể lưu ao', 'error');
    }
  };

  return (
    <div className="relative z-10 max-w-6xl mx-auto space-y-6">
      {/* Custom Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-right-8 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100/50">
            <Waves className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500 tracking-tight">Quản Lý Ao Nuôi</h2>
            <p className="text-sm text-slate-500 font-medium">Quản lý và theo dõi danh sách ao nuôi</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên ao nuôi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-inner"
            />
          </div>
          <button
            onClick={openAddModal}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Thêm mới
          </button>
        </div>
      </div>

      {/* Danh sách Thẻ Ao */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 text-sm font-medium">Đang tải dữ liệu...</p>
          </div>
        </div>
      ) : filteredPonds.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-slate-100 shadow-sm text-center px-6">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Waves className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">Chưa có ao nuôi nào</h3>
          <p className="text-slate-500 text-sm mb-4">Bạn có thể thêm ao nuôi mới để bắt đầu quản lý.</p>
          <button
            onClick={openAddModal}
            className="text-blue-600 font-semibold text-sm hover:underline flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Thêm ao ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPonds.map(pond => (
            <div key={pond.id} onClick={() => setViewingPond(pond)} className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all hover:-translate-y-1.5 duration-500 group flex flex-col cursor-pointer overflow-hidden relative">
              <div className="h-24 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/20 backdrop-blur-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              </div>
              <div className="p-6 relative flex-1 flex flex-col">
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={(e) => { e.stopPropagation(); setViewingPond(pond); }} className="p-2 bg-white/90 text-blue-600 hover:bg-blue-50 rounded-xl shadow-sm transition-colors" title="Xem chi tiết"><Eye className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); openEditModal(pond); }} className="p-2 bg-white/90 text-blue-600 hover:bg-blue-50 rounded-xl shadow-sm transition-colors" title="Chỉnh sửa"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={(e) => handleDelete(e, pond.id)} className="p-2 bg-white/90 text-red-600 hover:bg-red-50 rounded-xl shadow-sm transition-colors" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="w-14 h-14 bg-white border border-white/80 rounded-2xl flex items-center justify-center absolute -top-10 shadow-xl shadow-blue-900/10 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-500 z-20">
                  <Waves className="w-7 h-7 text-blue-600" />
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-slate-800">{pond.name}</h3>
                    {pond.farm?.status === 'INACTIVE' && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 rounded-md">
                        Ngưng hoạt động
                      </span>
                    )}
                  </div>
                  <div className="space-y-4 flex-1">
                    <div className="flex items-start gap-2 text-slate-600 text-sm bg-slate-50/80 p-3 rounded-xl border border-slate-100/50 shadow-inner">
                      <Map className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                      <span className="line-clamp-2 font-medium leading-relaxed">{pond.farm?.name || 'Trang trại không xác định'}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 flex flex-col gap-1 items-start transition-colors group-hover:bg-blue-50">
                        <div className="flex items-center gap-1.5 text-blue-600/80 text-xs font-bold uppercase tracking-wider">
                          <Maximize className="w-3.5 h-3.5" />
                          Diện tích
                        </div>
                        <p className="text-lg font-black text-slate-800">{pond.areaSize} <span className="text-sm font-bold text-slate-400">m²</span></p>
                      </div>
                      <div className="bg-cyan-50/50 p-3 rounded-2xl border border-cyan-100/50 flex flex-col gap-1 items-start transition-colors group-hover:bg-cyan-50">
                        <div className="flex items-center gap-1.5 text-cyan-600/80 text-xs font-bold uppercase tracking-wider">
                          <Waves className="w-3.5 h-3.5" />
                          Độ sâu
                        </div>
                        <p className="text-lg font-black text-slate-800">{pond.depth} <span className="text-sm font-bold text-slate-400">m</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Thêm Ao */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingPond ? 'Cập nhật Ao Nuôi' : 'Thêm Ao Nuôi Mới'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Chọn Trang trại <span className="text-red-500">*</span></label>
                <select 
                  required
                  value={formData.farmId}
                  onChange={e => setFormData({...formData, farmId: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                >
                  <option value="" disabled>-- Chọn trang trại --</option>
                  {farms.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {farms.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">Bạn chưa có trang trại nào, vui lòng tạo trang trại trước.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Tên ao <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="VD: Ao số 1"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Diện tích (m²) <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="1"
                    required
                    placeholder="VD: 1500"
                    value={formData.areaSize}
                    onChange={e => setFormData({...formData, areaSize: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Độ sâu (m) <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0.1"
                    required
                    placeholder="VD: 1.5"
                    value={formData.depth}
                    onChange={e => setFormData({...formData, depth: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={!formData.farmId}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-sm transition-colors"
                >
                  {editingPond ? 'Lưu Thay Đổi' : 'Lưu Ao Nuôi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PondDetailPanel 
        pond={viewingPond} 
        isOpen={!!viewingPond} 
        onClose={() => setViewingPond(null)} 
      />
    </div>
  );
}
