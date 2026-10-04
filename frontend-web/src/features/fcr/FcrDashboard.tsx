import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Waves, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { pondService } from '../../services/pond.service';
import FcrAnalysisDetail from './FcrAnalysisDetail';
import GrowthHeaderTabs, { type GrowthTabType } from '../growth/GrowthHeaderTabs';

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

interface FcrDashboardProps {
  onNavigateTab?: (tab: GrowthTabType) => void;
  initialFarmId?: string;
  initialPondId?: string;
  onSelectFarm?: (farmId: string) => void;
  onSelectPond?: (pondId: string) => void;
}

export default function FcrDashboard({
  onNavigateTab,
  initialFarmId,
  initialPondId,
  onSelectFarm,
  onSelectPond,
}: FcrDashboardProps) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [allPonds, setAllPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState(initialFarmId || '');
  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ponds = useMemo(
    () => selectedFarmId ? allPonds.filter((p) => p.farmId === selectedFarmId) : [],
    [selectedFarmId, allPonds],
  );

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setIsLoading(true);
      const overview = await pondService.getOverview();
      setFarms(overview.farms);
      setAllPonds(overview.ponds);
      if (overview.farms.length > 0) {
        setSelectedFarmId((prev) => {
          if (initialFarmId && overview.farms.some((f) => f.id === initialFarmId)) {
            onSelectFarm?.(initialFarmId);
            return initialFarmId;
          }
          const chosen = prev || overview.farms[0].id;
          onSelectFarm?.(chosen);
          return chosen;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách trang trại');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialFarmId && initialFarmId !== selectedFarmId) {
      setSelectedFarmId(initialFarmId);
      onSelectFarm?.(initialFarmId);
    }
  }, [initialFarmId]);

  useEffect(() => {
    if (initialPondId && ponds.length > 0) {
      const match = ponds.find((p) => p.id === initialPondId);
      if (match) {
        setSelectedPond(match);
        onSelectPond?.(match.id);
      }
    }
  }, [initialPondId, ponds]);

  if (selectedPond) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <GrowthHeaderTabs
          activeTab="Phân tích FCR"
          onTabChange={onNavigateTab}
          title="Phân Tích Hệ Số Chuyển Đổi Thức Ăn (FCR)"
          subtitle="Đánh giá hiệu quả sử dụng thức ăn và chi phí trên từng ao nuôi theo chu kỳ tăng trưởng"
        />
        <FcrAnalysisDetail 
          pond={selectedPond} 
          onBack={() => {
            setSelectedPond(null);
            onSelectPond?.('');
          }} 
          onNavigateTab={onNavigateTab}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl pb-10">
      {/* Shared Header Navigation */}
      <GrowthHeaderTabs
        activeTab="Phân tích FCR"
        onTabChange={onNavigateTab}
        title="Phân Tích Hệ Số Chuyển Đổi Thức Ăn (FCR)"
        subtitle="Đánh giá hiệu quả sử dụng thức ăn và chi phí trên từng ao nuôi theo chu kỳ tăng trưởng"
      />

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Farm Selection */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs w-full md:w-96">
        <label className="text-sm font-bold text-slate-700 block mb-2">Trang trại</label>
        <div className="relative">
          <select
            value={selectedFarmId}
            onChange={(e) => {
              setSelectedFarmId(e.target.value);
              onSelectFarm?.(e.target.value);
            }}
            className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-medium outline-none transition-all cursor-pointer"
          >
            <option value="">-- Chọn trang trại --</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Ponds Grid */}
      {selectedFarmId && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
            <Waves className="w-4 h-4 text-indigo-500" />
            Danh sách Ao nuôi
          </h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-indigo-500">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : ponds.length === 0 ? (
            <div className="text-center p-12 bg-white border border-slate-200/80 rounded-3xl shadow-xs">
              <p className="text-slate-500 text-sm">Không tìm thấy ao nuôi nào trong trang trại này.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ponds.map(pond => (
                <button
                  key={pond.id}
                  onClick={() => {
                    setSelectedPond(pond);
                    onSelectPond?.(pond.id);
                  }}
                  className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all text-left group flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Waves className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
                      {pond.name}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
