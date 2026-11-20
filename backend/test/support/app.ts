import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { testDatabaseUrl } from './config.js';

/** The whole application against the test database. */
export async function createTestApp(): Promise<INestApplication> {
  process.env.DATABASE_URL = testDatabaseUrl();
  // Imported late: the module validates the environment when it is loaded.
  const { AppModule } = await import('../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export type Agent = ReturnType<typeof request.agent>;

interface GqlBody {
  data?: Record<string, any> | null;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
}

/** Posts a GraphQL operation; returns the parsed body. */
export async function gql(
  client: Agent,
  query: string,
  variables?: object,
): Promise<GqlBody> {
  const res = await client.post('/graphql').send({ query, variables });
  return res.body as GqlBody;
}

/** `extensions` of the first error, e.g. `{ code: 'FORBIDDEN', reason: ... }`. */
export const errorOf = (body: GqlBody) => body.errors?.[0]?.extensions;
