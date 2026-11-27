/**
 * Generates API test cases from the application's own metadata:
 *  - routes, HTTP methods and guards from the NestJS controllers,
 *  - allowed roles from @Roles,
 *  - input rules from the class-validator decorators of each body/query DTO.
 * Every generated case is tied to one feature (FE-xx) through ROUTE_FE.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RequestMethod } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';
import { defaultMetadataStorage } from 'class-transformer/cjs/storage';
import { ApiCase } from './cases';
import { MISSING_ID, Role } from '../support/app-harness';

const ROLES_KEY = 'roles';
const ALL_ROLES: Role[] = ['ADMIN', 'FARM_MANAGER', 'TECHNICIAN', 'FARMER'];
const METHOD = { [RequestMethod.GET]: 'GET', [RequestMethod.POST]: 'POST', [RequestMethod.PUT]: 'PUT', [RequestMethod.PATCH]: 'PATCH', [RequestMethod.DELETE]: 'DELETE' } as Record<number, ApiCase['method']>;

/** Route → feature. Routes of modules outside FE-01…FE-57 (workspaces, support, chat, market prices) are not listed. */
export const ROUTE_FE: Record<string, string> = {
  'POST /api/auth/register': 'FE-01',
  'POST /api/auth/login': 'FE-02', 'POST /api/auth/google': 'FE-02',
  'POST /api/auth/logout': 'FE-03', 'POST /api/auth/refresh': 'FE-03', 'GET /api/auth/me': 'FE-03',
  'POST /api/auth/forgot-password': 'FE-04', 'POST /api/auth/reset-password': 'FE-04', 'PATCH /api/users/password': 'FE-04',
  'PATCH /api/users/:id/role': 'FE-05',
  'GET /api/users': 'FE-06', 'GET /api/users/lookup': 'FE-06', 'GET /api/users/candidates': 'FE-06',
  'GET /api/users/profile': 'FE-07', 'PATCH /api/users/profile': 'FE-07',
  'POST /api/users': 'FE-08',
  'PATCH /api/users/:id/status': 'FE-09',
  'GET /api/farms': 'FE-10', 'GET /api/farms/my': 'FE-10', 'GET /api/farms/:id': 'FE-10',
  'POST /api/farms': 'FE-11', 'PUT /api/farms/:id': 'FE-11', 'DELETE /api/farms/:id': 'FE-11', 'PATCH /api/farms/:id/owner': 'FE-11',
  'GET /api/farms/:id/staff': 'FE-12', 'POST /api/farms/:id/staff': 'FE-12', 'DELETE /api/farms/:id/staff/:userId': 'FE-12',
  'POST /api/farms/:farmId/invite-by-email': 'FE-12', 'GET /api/farm-staffs': 'FE-12', 'POST /api/farm-staffs': 'FE-12',
  'PUT /api/farm-staffs/:id': 'FE-12', 'DELETE /api/farm-staffs/:id': 'FE-12', 'GET /api/auth/verify-invite': 'FE-12', 'POST /api/auth/accept-invite': 'FE-12',
  'GET /api/ponds': 'FE-13', 'GET /api/ponds/:id': 'FE-13',
  'POST /api/ponds': 'FE-14', 'PUT /api/ponds/:id': 'FE-14', 'DELETE /api/ponds/:id': 'FE-14',
  'GET /api/ponds/overview': 'FE-15',
  'GET /api/crops': 'FE-16', 'GET /api/crops/:id': 'FE-16', 'POST /api/crops': 'FE-16', 'DELETE /api/crops/:id': 'FE-16',
  'PUT /api/crops/:id': 'FE-17',
  'POST /api/crops/:id/split': 'FE-18',
  'PATCH /api/crops/:id/harvest': 'FE-19', 'GET /api/crops/:id/harvest-summary': 'FE-19',
  'GET /api/crops/:id/detailed-report': 'FE-20',
  'POST /api/feeding-logs': 'FE-21', 'DELETE /api/feeding-logs/daily': 'FE-21',
  'POST /api/mortality-logs': 'FE-22', 'GET /api/mortality-logs/crop/:cropId': 'FE-22',
  'POST /api/shrimp-health': 'FE-23', 'GET /api/shrimp-health/:id': 'FE-23',
  'GET /api/environment': 'FE-24', 'POST /api/environment': 'FE-24', 'PUT /api/environment/:id': 'FE-24',
  'POST /api/water-quality': 'FE-25',
  'GET /api/water-quality/history': 'FE-26', 'GET /api/water-quality/pond/:pondId': 'FE-26',
  'GET /api/water-quality/trends': 'FE-27', 'GET /api/water-quality/manager-trends': 'FE-27',
  'GET /api/inventory': 'FE-28', 'GET /api/inventory/:id': 'FE-28', 'GET /api/inventory/suppliers': 'FE-28',
  'POST /api/inventory': 'FE-29', 'PUT /api/inventory/:id': 'FE-29', 'DELETE /api/inventory/:id': 'FE-29', 'POST /api/inventory/:id/import': 'FE-29',
  'POST /api/inventory/:id/usage': 'FE-30', 'GET /api/inventory/usage-logs': 'FE-30', 'GET /api/inventory/consumption-summary': 'FE-30',
  'GET /api/suppliers': 'FE-31', 'GET /api/suppliers/:id': 'FE-31', 'POST /api/suppliers': 'FE-31', 'PUT /api/suppliers/:id': 'FE-31', 'DELETE /api/suppliers/:id': 'FE-31',
  'POST /api/ponds/:pondId/size-samples': 'FE-32', 'GET /api/ponds/:pondId/size-samples': 'FE-32',
  'GET /api/ponds/:pondId/size-samples/latest': 'FE-33', 'DELETE /api/ponds/:pondId/size-samples/:sampleId': 'FE-33',
  'GET /api/survival-rate/crop/:cropId': 'FE-34', 'PATCH /api/survival-rate/crop/:cropId/harvest': 'FE-34',
  'GET /api/ponds/:pondId/size-samples/fcr': 'FE-35',
  'GET /api/crops/analytics/growth-trajectory': 'FE-36',
  'GET /api/admin/alerts': 'FE-38',
  'GET /api/weather': 'FE-39',
  'GET /api/weather/sync-alerts': 'FE-40',
  'GET /api/notifications': 'FE-41',
  'POST /api/incidents': 'FE-42', 'GET /api/incidents': 'FE-42', 'GET /api/incidents/:id': 'FE-42', 'PATCH /api/incidents/:id/assignment': 'FE-42',
  'PATCH /api/incidents/:id/start-treatment': 'FE-43', 'POST /api/incidents/:id/treatment-updates': 'FE-43',
  'PATCH /api/incidents/:id/resolve': 'FE-43', 'PATCH /api/incidents/:id/reopen': 'FE-43',
  'POST /api/chatbot/upload-and-parse': 'FE-45',
  'POST /api/chatbot/ask': 'FE-47',
  'GET /api/chatbot/documents': 'FE-48', 'GET /api/chatbot/documents/:id': 'FE-48', 'POST /api/chatbot/documents': 'FE-48',
  'DELETE /api/chatbot/documents/:id': 'FE-48', 'GET /api/chatbot/documents/drive/status': 'FE-48', 'POST /api/chatbot/documents/drive/sync': 'FE-48',
  'POST /api/chatbot/execute-action': 'FE-49',
  'GET /api/notifications/unread-count': 'FE-50',
  'PUT /api/notifications/:id/read': 'FE-51', 'PUT /api/notifications/read-all': 'FE-51', 'DELETE /api/notifications/:id': 'FE-51', 'DELETE /api/notifications': 'FE-51',
  'GET /api/crops/analytics/manager-summary': 'FE-52',
  'GET /api/shrimp-health/history': 'FE-53',
  'GET /api/feeding-logs': 'FE-54', 'GET /api/feeding-logs/details': 'FE-54',
  'GET /api/admin/dashboard-stats': 'FE-55', 'GET /api/admin/system-health': 'FE-55', 'GET /api/admin/saas-metrics': 'FE-55', 'GET /api/admin/audit-logs': 'FE-55',
  'GET /api/admin/report': 'FE-56',
  'GET /api/chatbot/export/inventory/:farmId': 'FE-57',
};

const NOW = '2026-11-10T08:00:00.000Z';

function loadControllers(): any[] {
  const root = path.join(__dirname, '../../src/modules');
  const out: any[] = [];
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.controller.ts')) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(p);
        for (const v of Object.values(mod)) if (typeof v === 'function' && Reflect.getMetadata('path', v) !== undefined) out.push(v);
      }
    }
  };
  walk(root);
  return out;
}

const join = (...parts: string[]) => '/' + parts.map((x) => x.replace(/^\/|\/$/g, '')).filter(Boolean).join('/');

// ---------------- DTO sample values ----------------
type Meta = { name: string; type: string; constraints: any[]; propertyName: string; each?: boolean };
const metasOf = (cls: any): Meta[] =>
  (getMetadataStorage() as any).getTargetValidationMetadatas(cls, '', true, false).map((m: any) => ({
    name: m.name ?? m.type, type: m.type, constraints: m.constraints ?? [], propertyName: m.propertyName, each: m.each,
  }));
const groupByProp = (ms: Meta[]) => ms.reduce((a, m) => ((a[m.propertyName] ??= []).push(m), a), {} as Record<string, Meta[]>);
const has = (ms: Meta[], n: string) => ms.find((m) => m.name === n);
const isOptional = (ms: Meta[]) => ms.some((m) => m.type === 'conditionalValidation');
const nestedType = (cls: any, prop: string) => (defaultMetadataStorage as any).findTypeMetadata(cls, prop)?.typeFunction?.();

const PATTERN_SAMPLES = ['Abcd1234!', '0912345678', 'abcd1234A', '+84912345678', 'sample', '06:00'];
function sampleFor(cls: any, prop: string, ms: Meta[], depth = 0): any {
  const c = (n: string) => has(ms, n)?.constraints ?? [];
  const nested = nestedType(cls, prop);
  if (has(ms, 'isArray') || has(ms, 'arrayMinSize') || has(ms, 'nestedValidation')) {
    const n = Math.max(1, Number(c('arrayMinSize')[0] ?? 1));
    const item = nested && depth < 3 ? sampleObject(nested, depth + 1) : 'sample';
    return Array.from({ length: n }, () => JSON.parse(JSON.stringify(item)));
  }
  if (has(ms, 'isObject')) return {};
  if (has(ms, 'isLength')) return '1'.repeat(Number(c('isLength')[0]) || 6);
  if (has(ms, 'isEnum')) return Object.values(c('isEnum')[0])[0];
  if (has(ms, 'isIn')) return c('isIn')[0][0];
  if (has(ms, 'isEmail')) return 'user.sample@test.local';
  if (has(ms, 'isUuid')) return MISSING_ID;
  if (has(ms, 'isDateString') || has(ms, 'isIso8601')) return NOW;
  if (has(ms, 'isBoolean')) return true;
  if (has(ms, 'matches')) {
    const re: RegExp = c('matches')[0];
    return PATTERN_SAMPLES.find((s) => re.test(s)) ?? 'sample';
  }
  if (has(ms, 'isInt') || has(ms, 'isNumber') || has(ms, 'isPositive') || has(ms, 'min') || has(ms, 'max')) {
    const lo = has(ms, 'min') ? Number(c('min')[0]) : 1;
    const hi = has(ms, 'max') ? Number(c('max')[0]) : lo + 100;
    let v = Math.max(lo, Math.min(hi, lo <= 10 && hi >= 10 ? 10 : lo + (hi - lo) / 2));
    if (has(ms, 'isInt')) v = Math.ceil(v);
    if (has(ms, 'isPositive') && v <= 0) v = 1;
    return v;
  }
  const minLen = Number(c('minLength')[0] ?? c('isLength')[0] ?? 0);
  const base = 'Sample text';
  return base.length >= minLen ? base : base.padEnd(minLen, 'x');
}
function sampleObject(cls: any, depth = 0): Record<string, any> {
  const props = groupByProp(metasOf(cls));
  const o: Record<string, any> = {};
  for (const [p, ms] of Object.entries(props)) if (!isOptional(ms)) o[p] = sampleFor(cls, p, ms, depth);
  return o;
}

interface Neg { type: ApiCase['type']; title: string; patch: Record<string, any>; drop?: string }
function negatives(cls: any): Neg[] {
  const props = groupByProp(metasOf(cls));
  const out: Neg[] = [];
  for (const [p, ms] of Object.entries(props)) {
    const c = (n: string) => has(ms, n)?.constraints ?? [];
    const opt = isOptional(ms);
    if (!opt && (has(ms, 'isNotEmpty') || ms.length > 0)) out.push({ type: 'Invalid input', title: `missing required field "${p}"`, patch: {}, drop: p });
    if (has(ms, 'isEnum') || has(ms, 'isIn')) out.push({ type: 'Invalid input', title: `value "INVALID_VALUE" for "${p}"`, patch: { [p]: 'INVALID_VALUE' } });
    if (has(ms, 'isEmail')) out.push({ type: 'Invalid input', title: `email format "not-an-email" for "${p}"`, patch: { [p]: 'not-an-email' } });
    if (has(ms, 'isUuid')) out.push({ type: 'Invalid input', title: `UUID "abc" for "${p}"`, patch: { [p]: 'abc' } });
    if (has(ms, 'isDateString') || has(ms, 'isIso8601')) out.push({ type: 'Invalid input', title: `date "not-a-date" for "${p}"`, patch: { [p]: 'not-a-date' } });
    if (has(ms, 'isBoolean')) out.push({ type: 'Invalid input', title: `boolean value "maybe" for "${p}"`, patch: { [p]: 'maybe' } });
    if (has(ms, 'matches')) out.push({ type: 'Invalid input', title: `format "invalid#value" for "${p}"`, patch: { [p]: 'invalid#value' } });
    if (has(ms, 'isInt') || has(ms, 'isNumber')) out.push({ type: 'Invalid input', title: `non-numeric value "abc" for "${p}"`, patch: { [p]: 'abc' } });
    if (has(ms, 'isInt')) out.push({ type: 'Invalid input', title: `decimal value 1.5 for integer "${p}"`, patch: { [p]: 1.5 } });
    if (has(ms, 'isPositive')) out.push({ type: 'Min boundary', title: `"${p}" = 0 (must be positive)`, patch: { [p]: 0 } });
    if (has(ms, 'min')) { const m = Number(c('min')[0]); const step = has(ms, 'isInt') || Number.isInteger(m) && !String(m).includes('.') && m >= 1 ? 1 : 0.01; out.push({ type: 'Min boundary', title: `"${p}" = ${+(m - step).toFixed(2)} (minimum is ${m})`, patch: { [p]: +(m - step).toFixed(2) } }); }
    if (has(ms, 'max')) { const m = Number(c('max')[0]); const step = has(ms, 'isInt') || Number.isInteger(m) ? 1 : 0.01; out.push({ type: 'Max boundary', title: `"${p}" = ${+(m + step).toFixed(2)} (maximum is ${m})`, patch: { [p]: +(m + step).toFixed(2) } }); }
    if (has(ms, 'minLength') && Number(c('minLength')[0]) > 1) { const m = Number(c('minLength')[0]); out.push({ type: 'Min boundary', title: `"${p}" with ${m - 1} characters (minimum is ${m})`, patch: { [p]: 'Ab1!'.padEnd(m - 1, 'x').slice(0, m - 1) } }); }
    if (has(ms, 'maxLength')) { const m = Number(c('maxLength')[0]); out.push({ type: 'Max boundary', title: `"${p}" with ${m + 1} characters (maximum is ${m})`, patch: { [p]: 'x'.repeat(m + 1) } }); }
    if (has(ms, 'isLength')) {
      const [a, b] = c('isLength').map(Number);
      if (a > 1) out.push({ type: 'Min boundary', title: `"${p}" with ${a - 1} characters (minimum is ${a})`, patch: { [p]: '1'.repeat(a - 1) } });
      if (b) out.push({ type: 'Max boundary', title: `"${p}" with ${b + 1} characters (maximum is ${b})`, patch: { [p]: '1'.repeat(b + 1) } });
    }
    if (has(ms, 'arrayMinSize')) { const m = Number(c('arrayMinSize')[0]); out.push({ type: 'Min boundary', title: `"${p}" with ${m - 1} item(s) (minimum is ${m})`, patch: { [p]: [] }, drop: undefined }); }
    if (has(ms, 'arrayMaxSize')) { const m = Number(c('arrayMaxSize')[0]); out.push({ type: 'Max boundary', title: `"${p}" with ${m + 1} items (maximum is ${m})`, patch: { [p]: '__REPEAT__' + (m + 1) } }); }
  }
  out.push({ type: 'Invalid input', title: 'unknown field "unexpectedField" in the request', patch: { unexpectedField: 'x' } });
  return out;
}

export function generateCases(): ApiCase[] {
  const cases: ApiCase[] = [];
  const seen = new Set<string>();
  for (const ctrl of loadControllers()) {
    const base = Reflect.getMetadata('path', ctrl) as string;
    const clsGuards = (Reflect.getMetadata('__guards__', ctrl) ?? []).map((g: any) => g.name);
    const clsRoles: string[] | undefined = Reflect.getMetadata(ROLES_KEY, ctrl);
    for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
      const h = ctrl.prototype[name];
      if (name === 'constructor' || typeof h !== 'function') continue;
      const mpath = Reflect.getMetadata('path', h);
      const m = Reflect.getMetadata('method', h);
      if (mpath === undefined || METHOD[m] === undefined) continue;
      const method = METHOD[m];
      const route = join('api', base, mpath);
      const key = `${method} ${route}`;
      const fe = ROUTE_FE[key];
      if (!fe || seen.has(key)) continue;
      seen.add(key);
      const guards = [...clsGuards, ...(Reflect.getMetadata('__guards__', h) ?? []).map((g: any) => g.name)];
      const protectedRoute = guards.includes('JwtAuthGuard');
      const roles: string[] | undefined = Reflect.getMetadata(ROLES_KEY, h) ?? clsRoles;
      const enforcesRoles = guards.includes('RolesGuard') && roles && roles.length > 0;
      const allowed = (enforcesRoles ? roles! : ALL_ROLES)[0] as Role;
      const concrete = route.replace(/:[A-Za-z]+/g, MISSING_ID);
      const args = Reflect.getMetadata('__routeArguments__', ctrl, name) ?? {};
      const ptypes = Reflect.getMetadata('design:paramtypes', ctrl.prototype, name) ?? [];
      let bodyCls: any, queryCls: any;
      for (const [k, v] of Object.entries<any>(args)) {
        const kind = Number(k.split(':')[0]);
        const cls = ptypes[v.index];
        const isDto = cls && cls !== Object && cls !== String && cls !== Number && cls !== Boolean && metasOf(cls).length > 0;
        if (kind === 3 && !v.data && isDto) bodyCls = cls;
        if (kind === 4 && !v.data && isDto) queryCls = cls;
      }
      const single: Record<string, any> = {};
      for (const v of Object.values<any>(args)) {
        if (v && typeof v.data === 'string' && v.data && Object.keys(args).find((k) => args[k] === v && Number(k.split(':')[0]) === 3)) {
          single[v.data] = /email/i.test(v.data) ? 'staff.invite@test.local' : /role/i.test(v.data) ? 'TECHNICIAN' : 'Sample text';
        }
      }
      const body = bodyCls ? sampleObject(bodyCls) : Object.keys(single).length ? single : undefined;
      const what = `${method} ${route}`;
      if (protectedRoute) {
        cases.push({ fe, type: 'Unauthenticated', title: `Reject unauthenticated request to ${what}`, method, path: concrete, role: null, body, expect: 401,
          expected: 'The API returns 401 Unauthorized and no data is returned.', pre: 'No access token is sent.' });
        cases.push({ fe, type: 'Unauthenticated', title: `Reject unauthenticated request with an expired token to ${what}`, method, path: concrete, role: allowed, token: 'expired', body, expect: 401,
          expected: 'The API returns 401 Unauthorized because the access token has expired.', pre: 'The access token has expired.' });
      }
      if (protectedRoute) {
        cases.push({ fe, type: 'Unauthenticated', title: `Reject unauthenticated request with a forged token to ${what}`, method, path: concrete, role: allowed, token: 'invalid-signature', body, expect: 401,
          expected: 'The API returns 401 Unauthorized because the token signature is invalid.', pre: 'The access token is signed with a wrong secret.' });
      }
      if (protectedRoute && enforcesRoles) {
        for (const r of ALL_ROLES.filter((x) => !roles!.includes(x))) {
          cases.push({ fe, type: 'Forbidden', title: `Reject request from ${r} role to ${what}`, method, path: concrete, role: r, body, expect: 403,
            expected: `The API returns 403 Forbidden for the ${r} role and no data is changed.`, pre: `Signed in as ${r}; allowed roles: ${roles!.join(', ')}.` });
        }
      }
      if (/:[A-Za-z]+/.test(route) && method !== 'POST' || (method === 'POST' && /:[A-Za-z]+\//.test(route))) {
        cases.push({ fe, type: 'Not found', title: `Return not found for ${what} with an id that does not exist`, method, path: concrete, role: protectedRoute ? allowed : null, body, expect: [403, 404],
          expected: 'The API returns 404 Not Found (or 403 for a farm-scoped resource) and no data is exposed.', pre: 'The requested id does not exist.' });
      }
      for (const [cls, where] of [[bodyCls, 'body'], [queryCls, 'query']] as const) {
        if (!cls) continue;
        const valid = sampleObject(cls);
        for (const n of negatives(cls)) {
          const patched: Record<string, any> = { ...valid, ...n.patch };
          for (const [k, v] of Object.entries(patched)) if (typeof v === 'string' && v.startsWith('__REPEAT__')) {
            const times = Number(v.slice(10)); const one = (valid[k] ?? ['x'])[0]; patched[k] = Array.from({ length: times }, () => one);
          }
          if (n.drop) delete patched[n.drop];
          const prefix = n.type === 'Invalid input' ? 'Reject invalid ' : n.type === 'Min boundary' ? 'Reject value below minimum: ' : 'Reject value above maximum: ';
          const c: ApiCase = {
            fe, type: n.type, title: `${prefix}${n.title} (${where} of ${what})`, method, path: concrete, role: protectedRoute ? allowed : null,
            expect: 400, expected: `The API returns 400 Bad Request with a validation message; nothing is saved.`,
            pre: protectedRoute ? `Signed in as ${allowed}; all other fields are valid.` : 'No session is required; all other fields are valid.',
          };
          if (where === 'body') { c.body = valid; (c as any).negBody = patched; }
          else { c.body = body; (c as any).controlQuery = valid; c.query = patched; }
          cases.push(c);
        }
      }
    }
  }
  return cases;
}
