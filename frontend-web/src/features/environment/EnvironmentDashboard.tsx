import { useState, useEffect } from 'react';
import { ClipboardList, History, LineChart } from 'lucide-react';
import RecordWaterQuality from './RecordWaterQuality';
import WaterQualityHistory from './WaterQualityHistory';
import EnvironmentTrendDashboard from './EnvironmentTrendDashboard';

interface EnvironmentDashboardProps {
  viewOnly?: boolean;
}

export default function EnvironmentDashboard({ viewOnly = false }: EnvironmentDashboardProps) {
  const [subTab, setSubTab] = useState<'record' | 'history' | 'trend'>(viewOnly ? 'trend' : 'record');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const isFarmer = currentUser?.role === 'FARMER';
  const activeTabClass = isFarmer
    ? 'border-teal-600 text-teal-600'
    : 'border-indigo-600 text-indigo-600';

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* ── Sub Navigation Tabs ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6">
        {!viewOnly && (
          <button
            onClick={() => setSubTab('record')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
              subTab === 'record'
                ? activeTabClass
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Ghi nhận thông số
          </button>
        )}

        <button
          onClick={() => setSubTab('trend')}
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
            subTab === 'trend'
              ? activeTabClass
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <LineChart className="w-4 h-4" />
          Dashboard Xu hướng
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
            subTab === 'history'
              ? activeTabClass
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Lịch sử đo lường
        </button>
      </div>

      {/* ── Active Component View ─────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-300 flex-1 relative min-h-0">
        {subTab === 'record' ? <RecordWaterQuality /> : subTab === 'trend' ? <EnvironmentTrendDashboard /> : <WaterQualityHistory />}
      </div>
    </div>
  );
}
