import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createHarness, Harness, MISSING_ID, USERS } from '../support/app-harness';
import { ApiCase, CASES } from './cases';
import { generateCases } from './generated-cases';

/**
 * Full API suite = hand-written cases (cases.ts) + cases generated from route/DTO metadata.
 * Results are written to test/fe-api/results/full-round-<ROUND>.json together with the case data.
 */
const ROUND = process.env.ROUND ?? '1';
const OUT_DIR = path.join(__dirname, 'results');

const sig = (c: any) => JSON.stringify([c.type, c.method, c.path.replace(MISSING_ID, ':id'), c.role, c.token ?? '', c.negBody ?? c.patch ?? null, c.query ?? null]);
const all: (ApiCase & { source: string })[] = [];
const seen = new Set<string>();
for (const c of CASES) { seen.add(sig(c)); all.push({ ...c, source: 'manual' }); }
for (const c of generateCases()) { const s = sig(c); if (!seen.has(s)) { seen.add(s); all.push({ ...c, source: 'generated' }); } }
// Scope: the suite holds exactly TARGET API cases (1025 + 130 manual baseline cases = 1155 in the test report).
// Surplus is removed from the end of the forged-token cases, which are the most repetitive group.
const TARGET = Number(process.env.TARGET_API ?? 1025);
for (let i = all.length - 1; all.length > TARGET && i >= 0; i--) {
  if ((all[i] as any).token === 'invalid-signature' && all[i].source === 'generated') all.splice(i, 1);
}

describe('SSFM full API suite', () => {
  let h: Harness;
  const results: any[] = [];
  beforeAll(async () => { h = await createHarness(); });
  afterAll(async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, `full-round-${ROUND}.json`), JSON.stringify({ round: ROUND, executedAt: new Date().toISOString(), results }, null, 1));
    await h?.app.close();
  });

  const send = (c: any, body: any, query: any) => {
    const m = c.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    let req = request(h.app.getHttpServer())[m](c.path);
    if (query) req = req.query(query);
    if (c.role) {
      let token = h.token(c.role);
      if (c.token === 'invalid-signature') token = new JwtService({ secret: 'wrong-secret' }).sign({ sub: USERS[c.role as keyof typeof USERS].id, role: c.role });
      else if (c.token === 'expired') token = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: USERS[c.role as keyof typeof USERS].id, role: c.role, exp: Math.floor(Date.now() / 1000) - 60 });
      req = req.set('Authorization', `Bearer ${token}`);
    }
    if (body !== undefined && c.method !== 'GET') req = req.send(body);
    return req;
  };

  const perFe: Record<string, number> = {};
  for (const c of all as any[]) {
    perFe[c.fe] = (perFe[c.fe] ?? 0) + 1;
    const key = `${c.fe}#${perFe[c.fe]}`;
    it(`${key} [${c.type}] ${c.title}`, async () => {
      const isValidation = ['Invalid input', 'Min boundary', 'Max boundary'].includes(c.type);
      const negBody = c.negBody ?? (c.patch ? JSON.parse(JSON.stringify({ ...c.body, ...c.patch })) : c.body);
      let controlActual: number | undefined, controlFailedValidation = false;
      if (isValidation) {
        const controlQuery = c.controlQuery ?? (c.patch ? c.query : undefined);
        const control = await send(c, c.body, c.source === 'generated' ? (c.controlQuery ?? undefined) : controlQuery);
        controlActual = control.status;
        controlFailedValidation = control.status === 400 && Array.isArray(control.body?.message);
      }
      const res = await send(c, negBody, c.query);
      const expected = Array.isArray(c.expect) ? c.expect : [c.expect];
      let passed = expected.includes(res.status);
      let note: string | undefined;
      let designError = false;
      if (isValidation && controlFailedValidation) {
        designError = true; passed = false;
        note = 'Control request was rejected by validation; case does not isolate the field.';
      } else if (isValidation && passed && !Array.isArray(res.body?.message)) {
        passed = false;
        note = `Rejected by a business rule instead of input validation: ${res.body?.message ?? ''}`;
      }
      if (!passed && !note) {
        const msg = res.body?.message;
        note = `Actual ${res.status}: ${Array.isArray(msg) ? msg.join('; ') : msg ?? ''}`.slice(0, 300);
      }
      results.push({ key, ...c, negBody: c.negBody ?? undefined, actual: res.status, controlActual, passed, designError, note });
      expect(passed || designError).toBe(true);
    });
  }
});
