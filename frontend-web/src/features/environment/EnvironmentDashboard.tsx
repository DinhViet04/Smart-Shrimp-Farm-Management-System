import { useState } from 'react';
import { ClipboardList, History } from 'lucide-react';
import RecordWaterQuality from './RecordWaterQuality';
import WaterQualityHistory from './WaterQualityHistory';

interface EnvironmentDashboardProps {
  viewOnly?: boolean;
}

export default function EnvironmentDashboard({ viewOnly = false }: EnvironmentDashboardProps) {
  const [subTab, setSubTab] = useState<'record' | 'history'>(viewOnly ? 'history' : 'record');

  return (
    <div className="space-y-6">
      {/* ── Sub Navigation Tabs ────────────────────────────────────────────── */}
      {!viewOnly && (
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setSubTab('record')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
              subTab === 'record'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Ghi nhận thông số
          </button>

          <button
            onClick={() => setSubTab('history')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
              subTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Lịch sử đo lường
          </button>
        </div>
      )}

      {/* ── Active Component View ─────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-300">
        {subTab === 'record' ? <RecordWaterQuality /> : <WaterQualityHistory />}
      </div>
    </div>
  );
}
