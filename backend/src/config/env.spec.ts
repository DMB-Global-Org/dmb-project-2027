import { validateEnv } from './env.js';

const BASE = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };

describe('mail settings', () => {
  it('log messages to the console unless told otherwise', () => {
    const env = validateEnv(BASE);
    expect(env.MAIL_DRIVER).toBe('console');
    expect(env.MAIL_DISPATCH_INTERVAL_MS).toBe(10_000);
  });

  it('need an API key and a sender address for MailerSend', () => {
    expect(() => validateEnv({ ...BASE, MAIL_DRIVER: 'mailersend' })).toThrow(
      /MAILERSEND_API_KEY[\s\S]*MAIL_FROM_EMAIL/,
    );
  });

  it('accept a complete MailerSend setup', () => {
    const env = validateEnv({
      ...BASE,
      MAIL_DRIVER: 'mailersend',
      MAILERSEND_API_KEY: 'key',
      MAIL_FROM_EMAIL: 'no-reply@example.com',
    });
    expect(env.MAIL_DRIVER).toBe('mailersend');
  });

  it('refuse an unknown driver', () => {
    expect(() => validateEnv({ ...BASE, MAIL_DRIVER: 'smtp' })).toThrow();
  });
});

describe('APP_BASE_URL', () => {
  it('loses a trailing slash, so links have no double slash', () => {
    expect(
      validateEnv({ ...BASE, APP_BASE_URL: 'https://app.example.com/' })
        .APP_BASE_URL,
    ).toBe('https://app.example.com');
  });
});
