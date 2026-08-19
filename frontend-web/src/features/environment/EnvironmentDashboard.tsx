import { useState, useEffect } from 'react';
import { ClipboardList, History, LineChart } from 'lucide-react';
import RecordWaterQuality from './RecordWaterQuality';
import WaterQualityHistory from './WaterQualityHistory';
import EnvironmentTrendDashboard from './EnvironmentTrendDashboard';

interface EnvironmentDashboardProps {
  viewOnly?: boolean;
}

export default function EnvironmentDashboard({ viewOnly = false }: EnvironmentDashboardProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [subTab, setSubTab] = useState<'record' | 'history' | 'trend'>(
    viewOnly ? 'trend' : 'record'
  );

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        setCurrentUser(parsed);
        // If user is Farmer or Manager, default to 'trend'
        if (parsed.role === 'FARMER' || parsed.role === 'FARM_MANAGER' || viewOnly) {
          setSubTab('trend');
        } else {
          setSubTab('record');
        }
      } catch {
        /* ignore */
      }
    }
  }, [viewOnly]);

  const isFarmer = currentUser?.role === 'FARMER';
  const activeTabClass = isFarmer
    ? 'border-teal-600 text-teal-600'
    : 'border-indigo-600 text-indigo-600';

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* ── Sub Navigation Tabs ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        {/* Record parameters tab - Only for Technician / Admin (!viewOnly) */}
        {!viewOnly && currentUser?.role !== 'FARMER' && currentUser?.role !== 'FARM_MANAGER' && (
          <button
            onClick={() => setSubTab('record')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 whitespace-nowrap cursor-pointer ${
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
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 whitespace-nowrap cursor-pointer ${
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
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 whitespace-nowrap cursor-pointer ${
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
        {subTab === 'record' && !viewOnly ? (
          <RecordWaterQuality />
        ) : subTab === 'trend' ? (
          <EnvironmentTrendDashboard />
        ) : (
          <WaterQualityHistory />
        )}
      </div>
    </div>
  );
}
