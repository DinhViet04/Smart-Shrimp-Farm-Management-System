import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

interface WorkspaceOption {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

export default function WorkspaceSwitcher() {
  const [items, setItems] = useState<WorkspaceOption[]>([]);
  const [selectedId, setSelectedId] = useState(
    () => localStorage.getItem('active_workspace_id') || '',
  );

  useEffect(() => {
    let cancelled = false;
    void apiFetch('/api/workspaces')
      .then(async (response) => {
        if (!response.ok) throw new Error('Không thể tải workspace');
        return response.json() as Promise<WorkspaceOption[]>;
      })
      .then((workspaces) => {
        if (cancelled) return;
        const activeItems = workspaces.filter((item) => item.status === 'ACTIVE');
        setItems(activeItems);
        const stored = localStorage.getItem('active_workspace_id');
        const nextId = activeItems.some((item) => item.id === stored)
          ? stored!
          : activeItems[0]?.id || '';
        setSelectedId(nextId);
        if (nextId) {
          localStorage.setItem('active_workspace_id', nextId);
          if (nextId !== stored) {
            window.location.reload();
            return;
          }
          window.dispatchEvent(
            new CustomEvent('workspace-changed', {
              detail: { workspaceId: nextId },
            }),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items.length) return null;

  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2 sm:px-3">
      <Building2 className="h-4 w-4 text-slate-500" />
      <span className="sr-only">Workspace đang làm việc</span>
      <select
        value={selectedId}
        onChange={(event) => {
          const workspaceId = event.target.value;
          setSelectedId(workspaceId);
          localStorage.setItem('active_workspace_id', workspaceId);
          window.location.reload();
        }}
        className="max-w-28 bg-transparent text-xs font-bold text-slate-700 outline-none sm:max-w-48"
        title="Workspace đang làm việc"
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
