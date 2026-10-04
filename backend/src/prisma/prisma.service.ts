import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      max: 10,
      min: 5,
      idleTimeoutMillis: 300_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    // PrismaPg opens sockets lazily. Warm the five connections used by
    // overview and relation-heavy list queries so requests avoid TLS handshakes.
    await Promise.all([
      this.$queryRaw`SELECT 1`,
      this.$queryRaw`SELECT 1`,
      this.$queryRaw`SELECT 1`,
      this.$queryRaw`SELECT 1`,
      this.$queryRaw`SELECT 1`,
    ]);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
