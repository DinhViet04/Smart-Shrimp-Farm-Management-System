import { useState, useEffect } from 'react';
import { ClipboardList, LineChart, Wrench, ArrowUp } from 'lucide-react';
import RecordWaterQuality from './RecordWaterQuality';
import WaterQualityHistory from './WaterQualityHistory';
import EnvironmentTrendDashboard from './EnvironmentTrendDashboard';
import WaterTreatment, { type WaterWarningRecord } from './WaterTreatment';
import WaterTreatmentWorkspace from './WaterTreatmentWorkspace';

interface EnvironmentDashboardProps {
  viewOnly?: boolean;
  initialFarmId?: string;
  initialPondId?: string;
  initialSubTab?: 'record' | 'treatment' | 'trend';
}

export default function EnvironmentDashboard({
  viewOnly = false,
  initialFarmId,
  initialPondId,
  initialSubTab,
}: EnvironmentDashboardProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [subTab, setSubTab] = useState<'record' | 'treatment' | 'trend'>(() => {
    if (initialSubTab) return initialSubTab;
    if (viewOnly) return 'treatment';
    return 'record';
  });
  const [activeWorkspaceRecord, setActiveWorkspaceRecord] = useState<WaterWarningRecord | null>(null);

  // Đồng bộ bộ lọc Trang trại & Ao nuôi giữa Dashboard biểu đồ và Bảng lịch sử
  const [syncedFarmId, setSyncedFarmId] = useState<string | undefined>(initialFarmId);
  const [syncedPondId, setSyncedPondId] = useState<string | undefined>(initialPondId);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (initialPondId) {
      setSyncedPondId(initialPondId);
    }
  }, [initialPondId]);

  useEffect(() => {
    if (initialFarmId) {
      setSyncedFarmId(initialFarmId);
    }
  }, [initialFarmId]);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        setCurrentUser(parsed);
        // If user is Farmer or Manager, default to 'treatment' unless specified
        if (!initialSubTab) {
          if (parsed.role === 'FARMER' || parsed.role === 'FARM_MANAGER' || viewOnly) {
            setSubTab('treatment');
          } else {
            setSubTab('record');
          }
        }
      } catch {
        /* ignore */
      }
    }
  }, [viewOnly, initialSubTab]);

  const isFarmer = currentUser?.role === 'FARMER';
  const activeTabClass = isFarmer
    ? 'border-teal-600 text-teal-600'
    : 'border-indigo-600 text-indigo-600';

  const [targetTreatmentFarmId, setTargetTreatmentFarmId] = useState<string | undefined>(initialFarmId);
  const [targetTreatmentPondId, setTargetTreatmentPondId] = useState<string | undefined>(initialPondId);

  const handleNavigateToTreatment = (farmId: string, pondId: string, warningRecord?: WaterWarningRecord) => {
    setTargetTreatmentFarmId(farmId);
    setTargetTreatmentPondId(pondId);
    if (warningRecord) {
      setActiveWorkspaceRecord(warningRecord);
    } else {
      setSubTab('treatment');
    }
  };

  const handleNavigateToHistory = () => {
    setSubTab('trend');
    setTimeout(() => {
      document.getElementById('water-history-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const handleTrendFilterChange = (farmId: string, pondId: string) => {
    setSyncedFarmId(farmId);
    setSyncedPondId(pondId);
  };

  // ── Render Dedicated Full-Page Workspace (Giống TreatmentWorkspace của Sức khỏe tôm) ──
  if (activeWorkspaceRecord) {
    return (
      <WaterTreatmentWorkspace
        record={activeWorkspaceRecord}
        onBack={() => {
          setActiveWorkspaceRecord(null);
          setSubTab('treatment');
        }}
        onSaved={() => {
          setActiveWorkspaceRecord(null);
          setSubTab('treatment');
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 flex flex-col h-full">
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
          onClick={() => setSubTab('treatment')}
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 whitespace-nowrap cursor-pointer ${
            subTab === 'treatment'
              ? activeTabClass
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Xử lý môi trường nước
        </button>

        <button
          onClick={() => setSubTab('trend')}
          className={`pb-3.5 text-sm font-bold flex items-center gap-2 transition-all outline-none border-b-2 whitespace-nowrap cursor-pointer ${
            subTab === 'trend'
              ? activeTabClass
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <LineChart className="w-4 h-4" />
          Dashboard & Lịch sử đo lường
        </button>
      </div>

      {/* ── Active Component View ─────────────────────────────────────────── */}
      <div className="animate-in fade-in duration-300 flex-1 relative min-h-0">
        {subTab === 'record' && !viewOnly ? (
          <RecordWaterQuality
            onNavigateToTreatment={handleNavigateToTreatment}
            onNavigateToHistory={handleNavigateToHistory}
            initialFarmId={initialFarmId}
            initialPondId={initialPondId}
          />
        ) : subTab === 'treatment' ? (
          <WaterTreatment
            initialFarmId={targetTreatmentFarmId || initialFarmId}
            initialPondId={targetTreatmentPondId || initialPondId}
            onOpenWorkspace={(rec) => setActiveWorkspaceRecord(rec)}
          />
        ) : (
          <div className="space-y-8">
            {/* Thanh điều hướng nhanh trong trang */}
            <div className="sticky top-2 z-20 flex items-center justify-between gap-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200/90 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider hidden sm:inline">
                  Xem nhanh:
                </span>
                <button
                  type="button"
                  onClick={() => document.getElementById('water-trend-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-black transition-colors cursor-pointer border border-transparent hover:border-indigo-200"
                >
                  <LineChart className="w-3.5 h-3.5 text-indigo-600" />
                  <span>1. Biểu đồ xu hướng</span>
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('water-history-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 text-xs font-black transition-colors cursor-pointer border border-transparent hover:border-teal-200"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
                  <span>2. Bảng lịch sử đo lường</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="hidden md:inline">Bộ lọc</span> đồng bộ
                </span>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition-colors cursor-pointer"
                  title="Cuộn lên đầu trang"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 1. Dashboard Đồ Thị & Xu Hướng Môi Trường Nước (Phía trên) */}
            <div id="water-trend-section">
              <EnvironmentTrendDashboard
                initialFarmId={syncedFarmId}
                initialPondId={syncedPondId}
                onFilterChange={handleTrendFilterChange}
              />
            </div>

            {/* Dải phân cách trực quan giữa Đồ thị và Bảng lịch sử */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200/80" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-slate-50 px-4 text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2 border border-slate-200/60 rounded-full py-1">
                  <ClipboardList className="w-4 h-4 text-teal-600" />
                  <span>Nhật ký & Lịch sử đo lường chi tiết tại ao</span>
                </span>
              </div>
            </div>

            {/* 2. Lịch Sử Chi Tiết Các Lượt Đo Lường (Phía dưới) */}
            <div id="water-history-section">
              <WaterQualityHistory
                initialFarmId={syncedFarmId}
                initialPondId={syncedPondId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

