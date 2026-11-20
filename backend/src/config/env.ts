import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(8000),
    // Comma-separated list of exact origins allowed by CORS.
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url())),
    // Optional regex for dynamic origins, e.g. Vercel preview deployments.
    CORS_ORIGIN_PATTERN: z
      .string()
      .optional()
      .transform((value, ctx) => {
        if (!value) return undefined;
        try {
          return new RegExp(value);
        } catch {
          ctx.addIssue({
            code: 'custom',
            message: 'Invalid regular expression',
          });
          return z.NEVER;
        }
      }),
    DATABASE_URL: z.url(),
    // Public address of the frontend; registration links are built from it.
    APP_BASE_URL: z
      .url()
      .default('http://localhost:3000')
      .transform((value) => value.replace(/\/+$/, '')),
    // How long a login lasts.
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
    // Number of reverse proxies in front of the app (Render, Vercel). With it
    // set correctly, req.ip is the real client IP (login throttling, audit log).
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    // Outgoing e-mail: `console` only logs messages (development, and until the
    // sending domain is set up); `mailersend` sends them through MailerSend.
    MAIL_DRIVER: z.enum(['console', 'mailersend']).default('console'),
    MAILERSEND_API_KEY: z.string().min(1).optional(),
    MAIL_FROM_EMAIL: z.email().optional(),
    MAIL_FROM_NAME: z.string().min(1).default('dMb Projekt 2027'),
    // How often the outbox is sent; 0 turns the timer off (tests always do).
    MAIL_DISPATCH_INTERVAL_MS: z.coerce.number().int().min(0).default(10_000),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_DRIVER !== 'mailersend') return;
    for (const key of ['MAILERSEND_API_KEY', 'MAIL_FROM_EMAIL'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when MAIL_DRIVER=mailersend`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
