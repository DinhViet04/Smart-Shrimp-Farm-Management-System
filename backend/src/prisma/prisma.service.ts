import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      // DB (Supabase) ở xa: mở 1 kết nối mới mất ~1-1.5s, nên giữ sẵn kết nối lâu hơn
      // và cho phép nhiều request song song hơn. Giữ max <= pool_size của Supabase pooler.
      max: Number(process.env.DB_POOL_MAX) || 10,
      min: 2,
      idleTimeoutMillis: 300_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    try {
      await this.$queryRaw`SELECT 1`;
    } catch (err: any) {
      this.logger.warn(`Warm-up query warning: ${err?.message || err}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
