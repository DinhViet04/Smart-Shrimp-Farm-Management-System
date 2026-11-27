import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap, tap } from 'rxjs';
import { RealtimeAudience, RealtimeService } from './realtime.service.js';
import { RealtimeAction, RealtimeResource } from './realtime.types.js';

type Scope = 'farm' | 'workspace' | 'self' | 'users' | 'all';

interface RouteDescriptor {
  resource: RealtimeResource;
  scope: Scope;
  /** Tên route param chứa id của bản ghi chính (mặc định `id`). */
  entityParam?: string;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Các controller nghiệp vụ gắn với một trang trại. */
const FARM_SCOPED: Record<string, RealtimeResource> = {
  farms: 'farms',
  ponds: 'ponds',
  crops: 'crops',
  environment: 'environment',
  'water-quality': 'water-quality',
  incidents: 'incidents',
  inventory: 'inventory',
  suppliers: 'suppliers',
  'farm-staffs': 'farm-staffs',
  'feeding-logs': 'feeding-logs',
  'shrimp-health': 'shrimp-health',
  'survival-rate': 'survival-rate',
  'mortality-logs': 'survival-rate',
};

const CHATBOT_INTENT_RESOURCE: Record<string, RealtimeResource> = {
  CREATE_FARM: 'farms',
  CREATE_POND: 'ponds',
  CREATE_CROP: 'crops',
  IMPORT_INVENTORY: 'inventory',
  EXPORT_INVENTORY: 'inventory',
  RECORD_WATER_QUALITY: 'water-quality',
  RECORD_FEEDING: 'feeding-logs',
};

/**
 * Xác định resource/phạm vi từ route. Trả về null với các route không thay
 * đổi dữ liệu nghiệp vụ hoặc đã có kênh realtime riêng (chat, ticket hỗ trợ).
 */
export function describeRoute(
  segments: string[],
  body: any,
): RouteDescriptor | null {
  const [root, second] = segments;
  if (!root) return null;

  if (root === 'ponds' && segments.includes('size-samples')) {
    return { resource: 'shrimp-size', scope: 'farm', entityParam: 'sampleId' };
  }
  if (FARM_SCOPED[root]) {
    return { resource: FARM_SCOPED[root], scope: 'farm' };
  }

  switch (root) {
    case 'chatbot': {
      if (second === 'execute-action') {
        const resource = CHATBOT_INTENT_RESOURCE[body?.intent];
        return resource ? { resource, scope: 'farm' } : null;
      }
      if (second === 'documents')
        return { resource: 'knowledge', scope: 'all' };
      return null;
    }
    case 'notifications':
      return { resource: 'notifications', scope: 'self' };
    case 'users':
      return second === 'profile' || second === 'password'
        ? { resource: 'users', scope: 'self' }
        : { resource: 'users', scope: 'users' };
    case 'workspaces':
      return { resource: 'workspaces', scope: 'workspace' };
    case 'market-prices':
      return { resource: 'market-prices', scope: 'all' };
    default:
      // auth, chat-groups, support-tickets, reports, weather, admin, ...
      return null;
  }
}

function routeSegments(req: any): string[] {
  const raw: string =
    req.route?.path || (req.originalUrl || req.url || '').split('?')[0];
  return raw
    .split('/')
    .filter(Boolean)
    .filter((seg, idx) => !(idx === 0 && seg === 'api'));
}

function actionFor(method: string, segments: string[]): RealtimeAction {
  if (method === 'DELETE') return 'deleted';
  if (method === 'POST' && !segments.some((s) => s.startsWith(':'))) {
    return 'created';
  }
  return 'updated';
}

const pick = (...values: unknown[]): string | null => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
};

/**
 * Interceptor toàn cục: sau mỗi request ghi dữ liệu thành công, phát sự kiện
 * `dataChanged` tới đúng những người có quyền xem dữ liệu đó để client tự
 * tải lại — không cần sửa từng service.
 */
@Injectable()
export class RealtimeInterceptor implements NestInterceptor {
  constructor(private readonly realtime: RealtimeService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const method = String(req.method || '').toUpperCase();
    if (!MUTATING_METHODS.has(method)) return next.handle();

    const segments = routeSegments(req);
    const body = req.body ?? {};
    const descriptor = describeRoute(segments, body);
    if (!descriptor) return next.handle();

    const params = req.params ?? {};
    const query = req.query ?? {};
    const data = body?.data && typeof body.data === 'object' ? body.data : {};
    const actorId: string | null = pick(
      req.user?.userId,
      req.user?.sub,
      req.user?.id,
    );
    const entityParam = descriptor.entityParam ?? 'id';
    const entityId = pick(params[entityParam]);

    // Tra farmId TRƯỚC khi handler chạy để vẫn biết phạm vi khi bản ghi bị xóa.
    const preResolve = async (): Promise<string | null> => {
      if (descriptor.scope !== 'farm') return null;
      const direct = pick(
        params.farmId,
        body.farmId,
        query.farmId,
        data.farmId,
      );
      if (direct) return direct;
      const pondId = pick(
        params.pondId,
        body.pondId,
        query.pondId,
        data.pondId,
      );
      if (pondId) {
        const id = await this.realtime.farmIdFromPond(pondId);
        if (id) return id;
      }
      const cropId = pick(
        params.cropId,
        body.cropId,
        query.cropId,
        data.cropId,
      );
      if (cropId) {
        const id = await this.realtime.farmIdFromCrop(cropId);
        if (id) return id;
      }
      return entityId
        ? this.realtime.farmIdFromEntity(descriptor.resource, entityId)
        : null;
    };

    let preFarmId: string | null = null;

    return from(
      preResolve()
        .then((id) => {
          preFarmId = id;
        })
        .catch(() => undefined),
    ).pipe(
      switchMap(() => next.handle()),
      tap((response) => {
        // Không chặn phản hồi: phát sự kiện sau khi trả kết quả.
        setImmediate(() => {
          void this.emit(descriptor, {
            method,
            segments,
            params,
            body,
            response,
            actorId,
            entityId,
            preFarmId,
          });
        });
      }),
    );
  }

  private async emit(
    descriptor: RouteDescriptor,
    ctx: {
      method: string;
      segments: string[];
      params: any;
      body: any;
      response: any;
      actorId: string | null;
      entityId: string | null;
      preFarmId: string | null;
    },
  ) {
    const { response, params, body, actorId } = ctx;
    const res = response && typeof response === 'object' ? response : {};
    const resData = res.data && typeof res.data === 'object' ? res.data : {};
    const action = actionFor(ctx.method, ctx.segments);
    const entityId = ctx.entityId ?? pick(res.id, resData.id) ?? null;

    let audience: RealtimeAudience;
    let farmId: string | null = null;

    switch (descriptor.scope) {
      case 'all':
        audience = { kind: 'all' };
        break;
      case 'self':
        audience = { kind: 'users', userIds: actorId ? [actorId] : [] };
        break;
      case 'users':
        audience = {
          kind: 'users',
          userIds: [actorId, pick(params.id)].filter(Boolean) as string[],
          includeAdmins: true,
        };
        break;
      case 'workspace': {
        const workspaceId = pick(params.id, res.id, res.workspaceId);
        audience = workspaceId
          ? { kind: 'workspace', workspaceId }
          : { kind: 'actor-scope', actorId: actorId ?? '' };
        break;
      }
      case 'farm':
      default: {
        farmId =
          ctx.preFarmId ??
          pick(
            res.farmId,
            resData.farmId,
            res.pond?.farmId,
            res.crop?.pond?.farmId,
            descriptor.resource === 'farms' ? res.id : null,
            descriptor.resource === 'farms' ? resData.id : null,
          );
        if (!farmId) {
          const pondId = pick(res.pondId, resData.pondId, res.crop?.pondId);
          farmId = pondId ? await this.realtime.farmIdFromPond(pondId) : null;
        }
        if (!farmId) {
          const cropId = pick(res.cropId, resData.cropId);
          farmId = cropId ? await this.realtime.farmIdFromCrop(cropId) : null;
        }
        audience = farmId
          ? { kind: 'farm', farmId }
          : actorId
            ? { kind: 'actor-scope', actorId }
            : { kind: 'users', userIds: [], includeAdmins: true };
      }
    }

    await this.realtime.publish({
      resource: descriptor.resource,
      action,
      audience,
      farmId,
      entityId,
      actorId,
      extraUserIds: [
        pick(params.userId),
        pick(body?.userId),
        pick(body?.assignedToId),
      ].filter(Boolean) as string[],
    });
  }
}
