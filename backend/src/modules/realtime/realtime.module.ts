import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeService } from './realtime.service.js';
import { RealtimeInterceptor } from './realtime.interceptor.js';

/**
 * Đồng bộ dữ liệu realtime cho toàn hệ thống: mọi request ghi dữ liệu thành
 * công sẽ phát sự kiện `dataChanged` qua Socket.IO (namespace /notifications).
 */
@Global()
@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [
    RealtimeService,
    { provide: APP_INTERCEPTOR, useClass: RealtimeInterceptor },
  ],
  exports: [RealtimeService],
})
export class RealtimeModule {}
