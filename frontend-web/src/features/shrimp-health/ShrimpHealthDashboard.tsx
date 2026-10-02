import { useState, useEffect } from 'react';
import { ClipboardList, History } from 'lucide-react';
import CreateShrimpHealth from './CreateShrimpHealth';
import ShrimpHealthList from './ShrimpHealthList';

interface ShrimpHealthDashboardProps {
  viewOnly?: boolean;
  initialFarmId?: string;
  initialPondId?: string;
}

export default function ShrimpHealthDashboard({
  viewOnly = false,
  initialFarmId,
  initialPondId,
}: ShrimpHealthDashboardProps) {
  const [subTab, setSubTab] = useState<'record' | 'history'>(
    viewOnly || initialPondId ? 'history' : 'record',
  );
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (initialPondId) {
      setSubTab('history');
    }
  }, [initialPondId]);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        setCurrentUser(parsed);
        if (parsed.role === 'FARMER' || parsed.role === 'FARM_MANAGER' || viewOnly || initialPondId) {
          setSubTab('history');
        }
      } catch {
        /* ignore */
      }
    }
  }, [viewOnly, initialPondId]);

  const isFarmer = currentUser?.role === 'FARMER';
  const activeTabClass = isFarmer
    ? 'border-teal-600 text-teal-600'
    : 'border-indigo-600 text-indigo-600';

  return (
    <div className="space-y-6">
      {/* ── Sub Navigation Tabs ────────────────────────────────────────────── */}
      {!viewOnly && currentUser?.role !== 'FARMER' && currentUser?.role !== 'FARM_MANAGER' && (
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
        {subTab === 'record' && !viewOnly ? (
          <CreateShrimpHealth />
        ) : (
          <ShrimpHealthList
            initialFarmId={initialFarmId}
            initialPondId={initialPondId}
          />
        )}
      </div>
    </div>
  );
}
