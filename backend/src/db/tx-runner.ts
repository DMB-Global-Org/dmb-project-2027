import { Inject, Injectable } from '@nestjs/common';
import { DB, type Database } from './database.tokens.js';

/** Transaction handle passed to the callback of {@link TxRunner.run}. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Single entry point for multi-statement work. Everything inside the callback
 * commits together or rolls back together, including DDL (creating a schema
 * during a Platinum promotion relies on this).
 */
@Injectable()
export class TxRunner {
  constructor(@Inject(DB) private readonly db: Database) {}

  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }
}
