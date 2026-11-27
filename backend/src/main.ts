import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import { getAllowedOrigins } from './config/environment.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Đóng kết nối DB gọn gàng khi Docker gửi SIGTERM (restart/redeploy)
  app.enableShutdownHooks();
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // Lịch sử chat AI gửi cả cuộc trò chuyện (có thể vượt giới hạn 100kb mặc định) —
  // chỉ nới giới hạn cho đúng route này, các route khác giữ mặc định.
  // BẮT BUỘC bọc trong hàm khác tên: Nest bỏ qua bộ đọc JSON mặc định nếu thấy middleware
  // tên "jsonParser" đã được đăng ký -> mọi route khác sẽ nhận body rỗng.
  const chatSessionsJsonParser = json({ limit: '2mb' });
  app.use('/api/chatbot/sessions', (req: any, res: any, next: any) => chatSessionsJsonParser(req, res, next));

  // Global prefix
  app.setGlobalPrefix('api');

  const allowedOrigins = getAllowedOrigins(process.env);

  // Only allow configured frontends and local dev tools (Expo Web/Mobile)
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' &&
          /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(
            origin,
          ));

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      transform: true, // Auto-transform payloads to DTO instances
      forbidNonWhitelisted: true, // Throw error on unknown properties
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 SSFM Backend running on http://localhost:${port}/api`);
}
bootstrap();
