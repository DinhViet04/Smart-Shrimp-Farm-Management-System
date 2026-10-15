import { useState, useEffect } from 'react';
import { ClipboardList, History, AlertTriangle } from 'lucide-react';
import CreateShrimpHealth from './CreateShrimpHealth';
import ShrimpHealthList from './ShrimpHealthList';
import IncidentDashboard from '../incidents/IncidentDashboard';

export type ShrimpHealthSubTab = 'record' | 'incident' | 'history';

interface ShrimpHealthDashboardProps {
  viewOnly?: boolean;
  initialFarmId?: string;
  initialPondId?: string;
  initialSubTab?: ShrimpHealthSubTab;
  initialIncidentSubTab?: 'board' | 'history';
  role?: 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER';
}

export default function ShrimpHealthDashboard({
  viewOnly = false,
  initialFarmId,
  initialPondId,
  initialSubTab,
  initialIncidentSubTab = 'board',
  role,
}: ShrimpHealthDashboardProps) {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  });

  const userRole = role || currentUser?.role || (viewOnly ? 'FARMER' : 'TECHNICIAN');
  const canRecord = !viewOnly && userRole !== 'FARMER' && userRole !== 'FARM_MANAGER' && userRole !== 'ADMIN';

  const [subTab, setSubTab] = useState<ShrimpHealthSubTab>(() => {
    if (initialSubTab) return initialSubTab;
    if (viewOnly || initialPondId || !canRecord) {
      return 'incident';
    }
    return 'record';
  });

  const [incidentSubTab, setIncidentSubTab] = useState<'incident' | 'treatment' | 'history' | 'board'>(initialIncidentSubTab);
  const [targetIncidentId, setTargetIncidentId] = useState<string | undefined>();

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (initialPondId && !initialSubTab) {
      setSubTab('incident');
    }
  }, [initialPondId, initialSubTab]);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        setCurrentUser(parsed);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleNavigateToIncident = (incidentId?: string, targetTab: 'incident' | 'treatment' = 'treatment') => {
    setIncidentSubTab(targetTab);
    setTargetIncidentId(incidentId);
    setSubTab('incident');
  };

  const handleNavigateToHistory = () => {
    setSubTab('history');
  };

  const isFarmer = userRole === 'FARMER';
  const activeTabClass = isFarmer
    ? 'border-teal-600 text-teal-600'
    : userRole === 'FARM_MANAGER' || userRole === 'ADMIN'
    ? 'border-blue-600 text-blue-600'
    : 'border-indigo-600 text-indigo-600';

  return (
    <div className="space-y-6">
      {/* ── Sub Navigation Tabs ────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        {canRecord && (
          <button
            onClick={() => setSubTab('record')}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 whitespace-nowrap cursor-pointer ${
              subTab === 'record'
                ? activeTabClass
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Kiểm tra sức khỏe
          </button>
        )}

        <button
          onClick={() => setSubTab('incident')}
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 whitespace-nowrap cursor-pointer ${
            subTab === 'incident'
              ? activeTabClass
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Sự cố & Điều trị
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
          Nhật ký kiểm tra định kỳ
        </button>
      </div>

      {/* ── Active Component View ─────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-300">
        {subTab === 'record' && canRecord ? (
          <CreateShrimpHealth
            onNavigateToIncident={handleNavigateToIncident}
            onNavigateToHistory={handleNavigateToHistory}
            isFarmer={isFarmer}
          />
        ) : subTab === 'incident' ? (
          <IncidentDashboard
            role={userRole}
            initialSubTab={incidentSubTab}
            initialIncidentId={targetIncidentId}
            onClearInitialIncidentId={() => setTargetIncidentId(undefined)}
          />
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
