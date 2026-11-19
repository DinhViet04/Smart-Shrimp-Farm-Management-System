import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createHarness, Harness, USERS } from '../support/app-harness';
import { ApiCase, CASES } from './cases';

/**
 * Runs every API case in cases.ts against the real application stack and writes the
 * observed results to test/fe-api/results/round-<ROUND>.json (ROUND defaults to 1).
 */
const ROUND = process.env.ROUND ?? '1';
const OUT_DIR = path.join(__dirname, 'results');

interface Result {
  key: string;
  fe: string;
  type: string;
  title: string;
  request: string;
  expected: number | number[];
  actual: number;
  controlActual?: number;
  passed: boolean;
  note?: string;
}

describe('SSFM feature API cases', () => {
  let h: Harness;
  const results: Result[] = [];
  const perFe: Record<string, number> = {};

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, `round-${ROUND}.json`),
      JSON.stringify({ round: ROUND, executedAt: new Date().toISOString(), results }, null, 2),
    );
    await h?.app.close();
  });

  const send = (c: ApiCase, body: any, query: any) => {
    const server = h.app.getHttpServer();
    const m = c.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    let req = request(server)[m](c.path);
    if (query) req = req.query(query);
    if (c.role) {
      let token = h.token(c.role);
      if (c.token === 'invalid-signature') {
        token = new JwtService({ secret: 'wrong-secret' }).sign({ sub: USERS[c.role].id, role: c.role });
      } else if (c.token === 'expired') {
        token = new JwtService({ secret: process.env.JWT_SECRET }).sign({
          sub: USERS[c.role].id,
          role: c.role,
          exp: Math.floor(Date.now() / 1000) - 60,
        });
      }
      req = req.set('Authorization', `Bearer ${token}`);
    }
    if (body !== undefined && c.method !== 'GET') req = req.send(body);
    return req;
  };

  for (const c of CASES) {
    perFe[c.fe] = (perFe[c.fe] ?? 0) + 1;
    const key = `${c.fe}#${perFe[c.fe]}`;
    it(`${key} [${c.type}] ${c.title}`, async () => {
      const isValidation = ['Invalid input', 'Min boundary', 'Max boundary'].includes(c.type);
      const negBody = c.patch ? JSON.parse(JSON.stringify({ ...c.body, ...c.patch })) : c.body;
      let controlActual: number | undefined;
      let controlFailedValidation = false;
      if (isValidation) {
        // Control: the same request without the faulty value must pass input validation.
        // ValidationPipe errors carry a message array; business-rule errors carry a string.
        const control = await send(c, c.body, c.patch ? c.query : undefined);
        controlActual = control.status;
        controlFailedValidation = control.status === 400 && Array.isArray(control.body?.message);
      }
      const res = await send(c, negBody, c.query);
      const expected = Array.isArray(c.expect) ? c.expect : [c.expect];
      let passed = expected.includes(res.status);
      let note: string | undefined;
      if (isValidation && passed && !Array.isArray(res.body?.message)) {
        passed = false;
        note = `Rejected by a business rule, not by input validation: ${res.body?.message ?? ''}`;
      }
      if (isValidation && controlFailedValidation) {
        passed = false;
        note = 'Control request was also rejected with 400 — case does not isolate the field.';
      }
      if (!passed && !note) {
        const msg = res.body?.message;
        note = `Actual ${res.status}: ${Array.isArray(msg) ? msg.join('; ') : msg ?? ''}`.slice(0, 300);
      }
      results.push({
        key,
        fe: c.fe,
        type: c.type,
        title: c.title,
        request: `${c.method} ${c.path}${c.query ? '?' + new URLSearchParams(c.query).toString() : ''}`,
        expected: c.expect,
        actual: res.status,
        controlActual,
        passed,
        note,
      });
      expect({ status: res.status, passed, note }).toEqual(expect.objectContaining({ passed: true }));
    });
  }
});
