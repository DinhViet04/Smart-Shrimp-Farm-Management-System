import { useState, useEffect } from 'react';
import { Waves, Calendar } from 'lucide-react';
import PondManagement from './PondManagement';
import CropManagement from './CropManagement';
import { type Crop } from '../services/crop.service';

interface PondCropDashboardProps {
  initialSubTab?: 'ponds' | 'crops';
  initialFarmId?: string;
  initialPondId?: string;
  initialCropYear?: string;
  initialCropQuarter?: string;
  initialCropView?: 'active' | 'history';
  initialCropConfig?: { farmId?: string; pondId?: string } | null;
  onNavigateToGrowth?: (config: { farmId: string; pondId: string; cropId?: string }) => void;
  /** 'farmer': tông teal, chữ to, tên tab dễ hiểu cho Nông dân */
  variant?: 'default' | 'farmer' | 'manager';
}

export default function PondCropDashboard({
  initialSubTab = 'ponds',
  initialFarmId,
  initialPondId,
  initialCropYear,
  initialCropQuarter,
  initialCropView,
  initialCropConfig,
  onNavigateToGrowth,
  variant = 'default',
}: PondCropDashboardProps = {}) {
  const isFarmer = variant === 'farmer';
  // Giao diện gọn (teal) cho Nông dân & Quản lý; tên tab riêng cho Nông dân
  const isCompact = variant !== 'default';
  const [activeSubTab, setActiveSubTab] = useState<'ponds' | 'crops'>(initialSubTab);
  const [editCropParam, setEditCropParam] = useState<Crop | null>(null);
  const [createCropParam, setCreateCropParam] = useState<{ farmId?: string; pondId?: string } | null>(
    initialCropConfig || null
  );

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (initialCropConfig) {
      setCreateCropParam(initialCropConfig);
      setActiveSubTab('crops');
    }
  }, [initialCropConfig]);

  const handleEditCrop = (crop: Crop) => {
    setEditCropParam(crop);
    setActiveSubTab('crops');
  };

  const handleNavigateToCreateCrop = (config: { farmId: string; pondId: string }) => {
    setCreateCropParam(config);
    setEditCropParam(null);
    setActiveSubTab('crops');
  };

  return (
    <div className={`w-full max-w-7xl mx-auto space-y-6 ${isCompact ? 'theme-farmer' : ''}`}>
      {/* ── Sub Navigation Tabs ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveSubTab('ponds')}
          className={`pb-3.5 ${isCompact ? 'text-base' : 'text-sm'} font-bold flex items-center gap-2 transition-all outline-none border-b-2 cursor-pointer ${
            activeSubTab === 'ponds'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Waves className={isCompact ? 'w-5 h-5' : 'w-4 h-4'} />
          {isFarmer ? 'Ao của tôi' : 'Quản lý Ao Nuôi'}
        </button>

        <button
          onClick={() => setActiveSubTab('crops')}
          className={`pb-3.5 ${isCompact ? 'text-base' : 'text-sm'} font-bold flex items-center gap-2 transition-all outline-none border-b-2 cursor-pointer ${
            activeSubTab === 'crops'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className={isCompact ? 'w-5 h-5' : 'w-4 h-4'} />
          {isFarmer ? 'Vụ nuôi của tôi' : 'Quản lý Vụ Nuôi'}
        </button>
      </div>

      {/* ── Tab View ──────────────────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-300">
        {activeSubTab === 'ponds' ? (
          <PondManagement 
            initialFarmId={initialFarmId}
            onEditCrop={handleEditCrop} 
            onNavigateToCreateCrop={handleNavigateToCreateCrop}
          />
        ) : (
          <CropManagement 
            initialView={initialCropView}
            initialFilterFarmId={initialFarmId}
            initialFilterPondId={initialPondId}
            initialFilterYear={initialCropYear}
            initialFilterQuarter={initialCropQuarter}
            initialEditCrop={editCropParam} 
            onClearEditCrop={() => setEditCropParam(null)} 
            initialCreateCropConfig={createCropParam}
            onClearCreateCropConfig={() => setCreateCropParam(null)}
            onNavigateToGrowth={onNavigateToGrowth}
          />
        )}
      </div>
    </div>
  );
}
