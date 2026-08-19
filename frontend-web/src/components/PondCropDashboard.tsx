import { useState } from 'react';
import { Waves, Calendar } from 'lucide-react';
import PondManagement from './PondManagement';
import CropManagement from './CropManagement';
import { type Crop } from '../services/crop.service';

export default function PondCropDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'ponds' | 'crops'>('ponds');
  const [editCropParam, setEditCropParam] = useState<Crop | null>(null);

  const handleEditCrop = (crop: Crop) => {
    setEditCropParam(crop);
    setActiveSubTab('crops');
  };

  return (
    <div className="space-y-6">
      {/* ── Sub Navigation Tabs ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveSubTab('ponds')}
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
            activeSubTab === 'ponds'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Waves className="w-4 h-4" />
          Quản lý Ao Nuôi
        </button>

        <button
          onClick={() => setActiveSubTab('crops')}
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
            activeSubTab === 'crops'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Quản lý Vụ Nuôi
        </button>
      </div>

      {/* ── Tab View ──────────────────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-300">
        {activeSubTab === 'ponds' ? (
          <PondManagement onEditCrop={handleEditCrop} />
        ) : (
          <CropManagement 
            initialEditCrop={editCropParam} 
            onClearEditCrop={() => setEditCropParam(null)} 
          />
        )}
      </div>
    </div>
  );
}
