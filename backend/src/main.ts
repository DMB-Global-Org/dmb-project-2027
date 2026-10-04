import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
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
