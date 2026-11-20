import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Env } from '../config/env.js';
import { DB, PG_CLIENT, type Database } from './database.tokens.js';
import * as schema from './schema/index.js';
import { TxRunner } from './tx-runner.js';

// Re-exported so existing imports of the token and type keep working.
export { DB, type Database };

@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [ConfigService],
      // Supabase transaction-mode pooler (Supavisor) does not support prepared statements.
      useFactory: (config: ConfigService<Env, true>) =>
        postgres(config.get('DATABASE_URL', { infer: true }), {
          prepare: false,
        }),
    },
    {
      provide: DB,
      inject: [PG_CLIENT],
      useFactory: (client: postgres.Sql): Database =>
        drizzle(client, { schema }),
    },
    TxRunner,
  ],
  exports: [DB, TxRunner],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown() {
    await this.client.end({ timeout: 5 });
  }
}
