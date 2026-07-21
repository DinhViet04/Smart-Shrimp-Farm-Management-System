import { useState, useEffect } from 'react';
import { ClipboardList, History } from 'lucide-react';
import CreateShrimpHealth from './CreateShrimpHealth';
import ShrimpHealthList from './ShrimpHealthList';

interface ShrimpHealthDashboardProps {
  viewOnly?: boolean;
}

export default function ShrimpHealthDashboard({ viewOnly = false }: ShrimpHealthDashboardProps) {
  const [subTab, setSubTab] = useState<'record' | 'history'>(viewOnly ? 'history' : 'record');
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
    <div className="space-y-6">
      {/* ── Sub Navigation Tabs ────────────────────────────────────────────── */}
      {!viewOnly && (
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setSubTab('record')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 ${
              subTab === 'record'
                ? activeTabClass
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Ghi nhận sức khỏe
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
            Lịch sử sức khỏe
          </button>
        </div>
      )}

      {/* ── Active Component View ─────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-300">
        {subTab === 'record' ? <CreateShrimpHealth /> : <ShrimpHealthList />}
      </div>
    </div>
  );
}
