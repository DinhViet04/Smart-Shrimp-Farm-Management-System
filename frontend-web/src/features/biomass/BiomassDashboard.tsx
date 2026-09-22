import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Waves, AlertCircle, Loader2, PieChart, ArrowRight } from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import PondBiomassDetail from './PondBiomassDetail';
import GrowthHeaderTabs, { type GrowthTabType } from '../growth/GrowthHeaderTabs';

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
  areaSize?: number;
  depth?: number;
}

interface BiomassDashboardProps {
  viewOnly?: boolean;
  onNavigateTab?: (tab: GrowthTabType) => void;
  initialFarmId?: string;
  initialPondId?: string;
}

export default function BiomassDashboard({
  onNavigateTab,
  initialFarmId,
  initialPondId,
}: BiomassDashboardProps) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState(initialFarmId || '');
  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
    try {
      setIsLoading(true);
      const data = await farmService.getAll();
      setFarms(data);
      if (data.length > 0) {
        setSelectedFarmId((prev) => {
          if (initialFarmId && data.some((f: Farm) => f.id === initialFarmId)) {
            return initialFarmId;
          }
          return prev || data[0].id;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách trang trại');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPonds = useCallback(async (farmId: string) => {
    if (!farmId) {
      setPonds([]);
      return;
    }
    try {
      setIsLoading(true);
      const data = await pondService.getAll();
      const farmPonds = data.filter((p: Pond) => p.farmId === farmId);
      setPonds(farmPonds);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách ao');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFarmId) {
      fetchPonds(selectedFarmId);
    }
  }, [selectedFarmId, fetchPonds]);

  useEffect(() => {
    if (initialFarmId && initialFarmId !== selectedFarmId) {
      setSelectedFarmId(initialFarmId);
    }
  }, [initialFarmId]);

  useEffect(() => {
    if (initialPondId && ponds.length > 0) {
      const match = ponds.find((p) => p.id === initialPondId);
      if (match) {
        setSelectedPond(match);
      }
    }
  }, [initialPondId, ponds]);

  // If a pond is selected, render the detail view
  if (selectedPond) {
    return (
      <PondBiomassDetail
        pond={selectedPond}
        onBack={() => setSelectedPond(null)}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl pb-10">
      {/* Shared Header Navigation */}
      <GrowthHeaderTabs
        activeTab="Sinh khối ao"
        onTabChange={onNavigateTab}
        title="Theo Dõi Sinh Khối & Mật Độ Ao Nuôi"
        subtitle="Ước tính tổng khối lượng tôm thịt trong ao (Biomass) và mật độ tôm (con/m²) bằng phương pháp chài mẫu"
      />

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Farm Selection & Formula Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Chọn Trang Trại
          </label>
          <div className="relative">
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-semibold outline-none transition-all cursor-pointer text-sm"
            >
              <option value="">-- Chọn trang trại --</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-5 rounded-3xl border border-emerald-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Phương Pháp Đo Lường</p>
            <p className="text-xl font-black text-emerald-950 mt-1">Chài Lưới 5 Mẻ Chuẩn</p>
            <p className="text-xs text-emerald-700/80 mt-0.5">Mật độ: D_mẫu = N_tổng / (5 × S_chài)</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <PieChart className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-5 rounded-3xl border border-blue-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Công Thức Sinh Khối (Biomass)</p>
            <p className="text-xl font-black text-blue-950 mt-1">Biomass = (N_ao × ABW)/1000</p>
            <p className="text-xs text-blue-700/80 mt-0.5">Hỗ trợ ra quyết định thu hoạch & tách ao</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Waves className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Ponds Grid */}
      {selectedFarmId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
              <PieChart className="w-4 h-4 text-emerald-600" />
              Chọn Ao Để Xem Chi Tiết Sinh Khối & Mật Độ
            </h2>
            <span className="text-xs font-medium text-slate-400">
              {ponds.length} ao sẵn có
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-16 text-emerald-600 bg-white rounded-3xl border border-slate-100">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : ponds.length === 0 ? (
            <div className="text-center p-12 bg-white border border-slate-200/80 rounded-3xl shadow-xs">
              <Waves className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-semibold">Không tìm thấy ao nuôi nào trong trang trại này.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ponds.map((pond) => (
                <button
                  key={pond.id}
                  onClick={() => setSelectedPond(pond)}
                  className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-xs">
                      <PieChart className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
                      Biểu đồ <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 text-base group-hover:text-emerald-600 transition-colors">
                      {pond.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 font-medium">
                      <span>Diện tích: {pond.areaSize ? `${pond.areaSize.toLocaleString()} m²` : 'Chưa nhập'}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Theo dõi sinh khối</span>
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                      Xem chi tiết
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
