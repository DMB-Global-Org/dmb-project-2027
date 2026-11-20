import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  // Behind Render/Vercel the real client IP is in X-Forwarded-For.
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  const originPattern = config.get('CORS_ORIGIN_PATTERN', { infer: true });
  app.enableCors({
    origin: [
      ...config.get('CORS_ORIGINS', { infer: true }),
      ...(originPattern ? [originPattern] : []),
    ],
  });
  app.enableShutdownHooks();
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
