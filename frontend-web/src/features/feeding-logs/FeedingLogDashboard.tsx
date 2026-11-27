import { useState } from 'react';
import { Utensils, History } from 'lucide-react';
import CreateFeedingLog, { type FeedingTarget } from './CreateFeedingLog';
import FeedingLogList from './FeedingLogList';

/** Nhật ký cho ăn — dành cho Nông dân */
export default function FeedingLogDashboard() {
  const [subTab, setSubTab] = useState<'create' | 'history'>('create');
  // Ao + ngày cần mở khi bấm "Sửa ngày này" ở tab Lịch sử
  const [target, setTarget] = useState<FeedingTarget | null>(null);

  const tabs = [
    { id: 'create' as const, label: 'Ghi cho ăn', icon: <Utensils className="w-5 h-5" /> },
    { id: 'history' as const, label: 'Lịch sử cho ăn', icon: <History className="w-5 h-5" /> },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 theme-farmer">
      <div className="flex border-b border-slate-200 gap-6" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={subTab === t.id}
            onClick={() => setSubTab(t.id)}
            className={`pb-3.5 text-base font-bold flex items-center gap-2 transition-all outline-none border-b-2 cursor-pointer ${
              subTab === t.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in duration-300">
        {subTab === 'create' ? (
          <CreateFeedingLog target={target} />
        ) : (
          <FeedingLogList
            onEditDay={(pondId, date) => {
              setTarget({ pondId, date, nonce: Date.now() });
              setSubTab('create');
            }}
          />
        )}
      </div>
    </div>
  );
}
