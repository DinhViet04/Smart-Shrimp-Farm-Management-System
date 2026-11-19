/**
 * Boots the real SSFM NestJS application (controllers, guards, pipes, services)
 * for API-level tests without a database: PrismaService is replaced by an
 * in-memory stub, and startup jobs that call external services are disabled.
 *
 * What is exercised for real: routing, JwtAuthGuard, RolesGuard, ValidationPipe,
 * DTO rules, and service-level "not found" / access checks that rely on lookups.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'ssfm-api-test-secret';
process.env.JWT_REFRESH_SECRET = 'ssfm-api-test-refresh-secret';
process.env.OPENAI_API_KEY = '';
process.env.AI_SERVICE_URL = 'http://127.0.0.1:9';
process.env.SMTP_HOST = '';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/none';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EmailService } from '../../src/modules/email/email.service';
import { MarketPricesService } from '../../src/modules/market-prices/market-prices.service';
import { ChatbotService } from '../../src/modules/chatbot/chatbot.service';
import { ChatGroupsService } from '../../src/modules/chat-groups/chat-groups.service';

export type Role = 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER';

export const USERS: Record<Role, { id: string; email: string; role: Role }> = {
  ADMIN: { id: '11111111-1111-4111-8111-111111111111', email: 'admin@test.local', role: 'ADMIN' },
  FARM_MANAGER: { id: '22222222-2222-4222-8222-222222222222', email: 'manager@test.local', role: 'FARM_MANAGER' },
  TECHNICIAN: { id: '33333333-3333-4333-8333-333333333333', email: 'tech@test.local', role: 'TECHNICIAN' },
  FARMER: { id: '44444444-4444-4444-8444-444444444444', email: 'farmer@test.local', role: 'FARMER' },
};

/** A syntactically valid UUID v4 that does not exist in the stub database. */
export const MISSING_ID = '99999999-9999-4999-8999-999999999999';

function userRow(where: any) {
  const u = Object.values(USERS).find(
    (x) => x.id === where?.id || x.email === where?.email,
  );
  if (!u) return null;
  return {
    ...u,
    fullName: `Test ${u.role}`,
    phone: null,
    address: null,
    avatarUrl: null,
    isActive: true,
    password: null,
    googleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Prisma stub: every lookup returns "nothing", user lookups return the test users. */
function createPrismaStub(): any {
  const empty = (method: string) => {
    if (method.startsWith('findMany') || method === 'groupBy') return [];
    if (method === 'count') return 0;
    if (method === 'aggregate') return { _sum: {}, _avg: {}, _count: {}, _min: {}, _max: {} };
    if (method.startsWith('find')) return null;
    if (method === 'deleteMany' || method === 'updateMany' || method === 'createMany') return { count: 0 };
    return null;
  };
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string | symbol) => {
          if (typeof method !== 'string' || method === 'then') return undefined;
          return async (args: any) => {
          if (name === 'user' && (method === 'findUnique' || method === 'findFirst')) {
            return userRow(args?.where);
          }
          return empty(method);
          };
        },
      },
    );
  const stub: any = new Proxy(
    {},
    {
      get: (_t, prop: string | symbol) => {
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        if (prop === '$connect' || prop === '$disconnect' || prop === 'onModuleInit' || prop === 'onModuleDestroy')
          return async () => undefined;
        if (prop === '$transaction')
          return async (arg: any) => (typeof arg === 'function' ? arg(stub) : Promise.all(arg));
        if (prop === '$queryRaw' || prop === '$queryRawUnsafe' || prop === '$executeRaw' || prop === '$executeRawUnsafe')
          return async () => [];
        if (prop.startsWith('$')) return async () => undefined;
        return model(prop);
      },
    },
  );
  return stub;
}

export interface Harness {
  app: INestApplication;
  token: (role: Role) => string;
}

export async function createHarness(): Promise<Harness> {
  // Rate limiting is a production safeguard; it is disabled so that many cases can hit one route.
  jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
  jest.spyOn(MarketPricesService.prototype as any, 'onModuleInit').mockResolvedValue(undefined);
  jest.spyOn(ChatbotService.prototype as any, 'onModuleInit').mockResolvedValue(undefined);
  jest.spyOn(ChatGroupsService.prototype as any, 'onModuleInit').mockResolvedValue(undefined);

  const emailStub = new Proxy(
    {},
    { get: (_t, p) => (p === 'then' || typeof p !== 'string' ? undefined : async () => undefined) },
  );

  const dbg = (m: string) => process.env.HARNESS_DEBUG && process.stdout.write(`[harness] ${m}\n`);
  dbg('compiling');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(createPrismaStub())
    .overrideProvider(EmailService)
    .useValue(emailStub)
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
  dbg('compiled');

  const app = moduleRef.createNestApplication({
    logger: process.env.HARNESS_DEBUG ? ['log', 'error', 'warn', 'debug'] : false,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  dbg('init');
  await app.init();
  dbg('ready');

  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const token = (role: Role) =>
    jwt.sign({ sub: USERS[role].id, email: USERS[role].email, role }, { expiresIn: '1h' });

  return { app, token };
}
