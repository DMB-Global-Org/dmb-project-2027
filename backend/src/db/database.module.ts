import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Env } from '../config/env.js';
import * as schema from './schema/index.js';

export const DB = Symbol('DB');
const PG_CLIENT = Symbol('PG_CLIENT');

export type Database = PostgresJsDatabase<typeof schema>;

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
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown() {
    await this.client.end({ timeout: 5 });
  }
}
