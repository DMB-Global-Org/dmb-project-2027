import { renderMail, resolveLocale } from './index.js';

const PAYLOAD = {
  url: 'https://app.example.com/register/abc_DEF-123',
  kind: 'PARTNER' as const,
  expiresAt: '2026-12-01T10:30:00.000Z',
};

describe('invitation e-mail', () => {
  it.each([
    ['pl', 'Zaproszenie do dMb Projekt 2027', 'Załóż konto'],
    ['de', 'Einladung zu dMb Projekt 2027', 'Konto anlegen'],
    ['en', 'Invitation to dMb Projekt 2027', 'Create account'],
  ])('is written in %s', (locale, subject, action) => {
    const mail = renderMail('invitation', PAYLOAD, locale, 'jan@example.com');

    expect(mail.to).toBe('jan@example.com');
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain(`${action}: ${PAYLOAD.url}`);
    expect(mail.html).toContain(`href="${PAYLOAD.url}"`);
  });

  it('falls back to Polish for a language it does not know', () => {
    expect(resolveLocale('fr')).toBe('pl');
    expect(resolveLocale('')).toBe('pl');
    expect(renderMail('invitation', PAYLOAD, 'fr', 'a@b.pl').subject).toBe(
      'Zaproszenie do dMb Projekt 2027',
    );
  });

  it('names the deadline in Warsaw time', () => {
    const mail = renderMail('invitation', PAYLOAD, 'en', 'a@b.pl');
    // 10:30 UTC is 11:30 in Warsaw in December.
    expect(mail.text).toContain('11:30');
  });

  it('says whether the account is a Platinum one', () => {
    const platinum = renderMail(
      'invitation',
      { ...PAYLOAD, kind: 'PLATINUM' },
      'en',
      'a@b.pl',
    );
    expect(platinum.text).toContain('Platinum');
    expect(
      renderMail('invitation', PAYLOAD, 'en', 'a@b.pl').text,
    ).not.toContain('Platinum');
  });

  it('escapes the link in the HTML part', () => {
    const mail = renderMail(
      'invitation',
      { ...PAYLOAD, url: 'https://x.test/?a=1&b="2"<script>' },
      'en',
      'a@b.pl',
    );
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&amp;b=&quot;2&quot;&lt;script&gt;');
  });
});
