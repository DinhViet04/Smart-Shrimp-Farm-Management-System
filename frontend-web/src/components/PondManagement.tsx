import { useState, useEffect } from 'react';
import { Plus, Map, Waves, Edit2, Trash2, Eye } from 'lucide-react';
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      
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
      fetchData();
    } catch (error: any) {
      alert('Lỗi: ' + error.message);
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
      } else {
        await pondService.create(data);
      }
      
      setShowModal(false);
      fetchData(); // Reload list
    } catch (error: any) {
      alert('Lỗi: ' + (error.message || 'Không thể lưu ao'));
    }
  };

  return (
    <div className="relative z-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản lý Ao Nuôi</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý và theo dõi danh sách ao nuôi thuộc trang trại của bạn.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Thêm Ao Nuôi
        </button>
      </div>

      {/* Danh sách Thẻ Ao */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full"></div>
        </div>
      ) : ponds.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Waves className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Chưa có Ao Nuôi nào</h3>
          <p className="text-slate-500 mb-6">Bạn chưa tạo ao nuôi nào. Hãy bấm Thêm Ao Nuôi để bắt đầu.</p>
          <button 
            onClick={openAddModal}
            className="text-blue-600 font-bold hover:underline"
          >
            + Bấm vào đây để thêm
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ponds.map(pond => (
            <div key={pond.id} onClick={() => setViewingPond(pond)} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group cursor-pointer">
              <div className="h-24 bg-gradient-to-r from-blue-500 to-cyan-500 relative">
                <div className="absolute inset-0 bg-white/20 backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div className="p-6 relative">
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={(e) => { e.stopPropagation(); setViewingPond(pond); }} className="p-2 bg-white/90 text-blue-600 hover:bg-blue-50 rounded-xl shadow-sm transition-colors" title="Xem chi tiết"><Eye className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); openEditModal(pond); }} className="p-2 bg-white/90 text-emerald-600 hover:bg-emerald-50 rounded-xl shadow-sm transition-colors" title="Chỉnh sửa"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={(e) => handleDelete(e, pond.id)} className="p-2 bg-white/90 text-red-600 hover:bg-red-50 rounded-xl shadow-sm transition-colors" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="w-14 h-14 bg-white border border-slate-200 rounded-xl flex items-center justify-center absolute -top-10 shadow-sm">
                  <Waves className="w-7 h-7 text-blue-600" />
                </div>
                <div className="mt-4">
                  <h3 className="text-xl font-bold text-slate-800 mb-1">{pond.name}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 font-medium mb-4">
                    <Map className="w-4 h-4" />
                    {pond.farm?.name || 'Trang trại không xác định'}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">Diện tích</p>
                      <p className="text-lg font-black text-slate-800">{pond.areaSize} <span className="text-sm font-medium text-slate-500">m²</span></p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">Độ sâu</p>
                      <p className="text-lg font-black text-slate-800">{pond.depth} <span className="text-sm font-medium text-slate-500">m</span></p>
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
