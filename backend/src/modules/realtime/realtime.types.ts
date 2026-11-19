/**
 * Tên các nhóm dữ liệu (resource) được đồng bộ realtime.
 * Client đăng ký theo các tên này để tự tải lại dữ liệu khi có thay đổi.
 */
export type RealtimeResource =
  | 'farms'
  | 'ponds'
  | 'crops'
  | 'environment'
  | 'water-quality'
  | 'incidents'
  | 'inventory'
  | 'suppliers'
  | 'farm-staffs'
  | 'feeding-logs'
  | 'shrimp-health'
  | 'shrimp-size'
  | 'survival-rate'
  | 'notifications'
  | 'users'
  | 'workspaces'
  | 'market-prices'
  | 'knowledge';

export type RealtimeAction = 'created' | 'updated' | 'deleted';

export const DATA_CHANGED_EVENT = 'dataChanged';

export interface DataChangedEvent {
  /** Resource chính bị thay đổi. */
  resource: RealtimeResource;
  /** Resource chính + các resource bị ảnh hưởng gián tiếp (vd: cho ăn → kho). */
  resources: RealtimeResource[];
  action: RealtimeAction;
  farmId?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  at: string;
}

/** Các resource bị ảnh hưởng dây chuyền khi một resource thay đổi. */
export const RELATED_RESOURCES: Partial<
  Record<RealtimeResource, RealtimeResource[]>
> = {
  farms: ['farm-staffs', 'ponds'],
  ponds: ['farms', 'crops'],
  crops: ['ponds', 'survival-rate'],
  'feeding-logs': ['inventory'],
  inventory: ['suppliers'],
  'farm-staffs': ['farms', 'users'],
  'shrimp-size': ['crops'],
  'survival-rate': ['crops'],
  'water-quality': ['environment'],
  environment: ['water-quality'],
  incidents: ['crops'],
  workspaces: ['users', 'farms'],
};
