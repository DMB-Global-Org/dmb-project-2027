import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { Env } from '../config/env.js';
import { ActorService } from './actor.service.js';
import { AUTH_CONFIG, authConfigFrom } from './auth.config.js';
import { AuthGuard } from './auth.guard.js';
import { AuthResolver } from './auth.resolver.js';
import { AuthService } from './auth.service.js';
import { LoginThrottle } from './login-throttle.js';
import { SessionService } from './session.service.js';

@Module({
  providers: [
    {
      provide: AUTH_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        authConfigFrom({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          SESSION_TTL_DAYS: config.get('SESSION_TTL_DAYS', { infer: true }),
        }),
    },
    ActorService,
    SessionService,
    LoginThrottle,
    AuthService,
    AuthResolver,
    // Every resolver needs a logged-in account unless marked @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, ActorService, SessionService],
})
export class AuthModule {}
