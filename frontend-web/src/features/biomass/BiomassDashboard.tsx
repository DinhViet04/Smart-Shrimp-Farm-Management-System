import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Waves, AlertCircle, Loader2, PieChart } from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import PondBiomassDetail from './PondBiomassDetail';

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

interface BiomassDashboardProps {
  viewOnly?: boolean;
}

export default function BiomassDashboard(_props: BiomassDashboardProps) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
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
        setSelectedFarmId(data[0].id);
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

  if (selectedPond) {
    return (
      <PondBiomassDetail 
        pond={selectedPond} 
        onBack={() => setSelectedPond(null)} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
          <PieChart className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">Sinh khối ao</h2>
          <p className="text-slate-500 text-sm mt-1">Chọn trang trại và ao để xem ước tính sinh khối hiện tại</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Farm Selection */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm w-full md:w-96">
        <label className="text-sm font-bold text-slate-700 block mb-2">Trang trại</label>
        <div className="relative">
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none font-medium outline-none transition-all cursor-pointer"
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
            <Waves className="w-4 h-4 text-emerald-500" />
            Danh sách Ao nuôi
          </h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-emerald-500">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : ponds.length === 0 ? (
            <div className="text-center p-12 bg-white border border-slate-100 rounded-3xl shadow-sm">
              <p className="text-slate-500 text-sm">Không tìm thấy ao nuôi nào trong trang trại này.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ponds.map(pond => (
                <button
                  key={pond.id}
                  onClick={() => setSelectedPond(pond)}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all text-left group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Waves className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      {pond.name}
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
