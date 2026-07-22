import { useState } from 'react';
import { Utensils, History } from 'lucide-react';
import CreateFeedingLog from './CreateFeedingLog';
import FeedingLogList from './FeedingLogList';

export default function FeedingLogDashboard() {
  const [subTab, setSubTab] = useState<'create' | 'history'>('create');

  return (
    <div className="space-y-6">
      {/* ── Sub Navigation Tabs ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setSubTab('create')}
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
            subTab === 'create'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Utensils className="w-4 h-4" />
          Ghi nhận cho ăn
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
            subTab === 'history'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Lịch sử cho ăn
        </button>
      </div>

      {/* ── Active Component View ─────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-300">
        {subTab === 'create' ? <CreateFeedingLog /> : <FeedingLogList />}
      </div>
    </div>
  );
}
