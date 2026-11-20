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

describe('invitation e-mail: inviter name', () => {
  it('names the inviter when known and says nothing otherwise', () => {
    const named = renderMail(
      'invitation',
      { ...PAYLOAD, inviterName: 'Jan <Kowalski>' },
      'pl',
      'a@b.pl',
    );
    expect(named.text).toContain('Zaprasza Cię: Jan <Kowalski>.');
    expect(named.html).toContain('Jan &lt;Kowalski&gt;');
    expect(
      renderMail('invitation', PAYLOAD, 'pl', 'a@b.pl').text,
    ).not.toContain('Zaprasza Cię');
  });
});

describe('profile completed e-mail', () => {
  const payload = {
    accountName: 'Anna Nowak',
    url: 'https://app.example.com/accounts/123',
  };

  it.each([
    ['pl', 'Profil uzupełniony: Anna Nowak', 'Przejdź do konta'],
    ['de', 'Profil vervollständigt: Anna Nowak', 'Zum Konto'],
    ['en', 'Profile completed: Anna Nowak', 'Open the account'],
  ])('is written in %s', (locale, subject, action) => {
    const mail = renderMail('profileCompleted', payload, locale, 'p@b.pl');

    expect(mail.to).toBe('p@b.pl');
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain(`${action}: ${payload.url}`);
    expect(mail.html).toContain(`href="${payload.url}"`);
  });

  it('falls back to Polish and escapes the name in the HTML part', () => {
    const mail = renderMail(
      'profileCompleted',
      { ...payload, accountName: '<b>Anna</b>' },
      'fr',
      'p@b.pl',
    );
    expect(mail.subject).toContain('Profil uzupełniony');
    expect(mail.html).not.toContain('<b>Anna</b>');
    expect(mail.html).toContain('&lt;b&gt;Anna&lt;/b&gt;');
  });
});

describe('sponsor changed e-mail', () => {
  const base = { personName: 'Anna Nowak', recommenderName: 'Jan Kowalski' };

  it.each([
    ['pl', 'Zmiana rekomendującego w dMb Projekt 2027'],
    ['de', 'Änderung des Empfehlenden in dMb Projekt 2027'],
    ['en', 'Change of sponsor in dMb Projekt 2027'],
  ])('is written in %s', (locale, subject) => {
    const mail = renderMail(
      'recommenderChanged',
      { ...base, variant: 'moved' },
      locale,
      'a@b.pl',
    );
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain('Jan Kowalski');
  });

  it('tells the moved person who the sponsor is and the sponsor who arrived', () => {
    const moved = renderMail(
      'recommenderChanged',
      { ...base, variant: 'moved' },
      'en',
      'a@b.pl',
    );
    const arrived = renderMail(
      'recommenderChanged',
      { ...base, variant: 'newRecommender' },
      'en',
      'j@b.pl',
    );
    expect(moved.text).toContain('Your sponsor');
    expect(moved.text).toContain('Jan Kowalski');
    expect(moved.text).not.toContain('Anna Nowak');
    expect(arrived.text).toContain('Anna Nowak is now in your downline');
  });

  it('falls back to Polish and escapes names in the HTML part', () => {
    const mail = renderMail(
      'recommenderChanged',
      {
        variant: 'newRecommender',
        personName: '<b>x</b>',
        recommenderName: 'y',
      },
      'fr',
      'a@b.pl',
    );
    expect(mail.subject).toContain('Zmiana rekomendującego');
    expect(mail.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>x</b>');
  });
});

describe('promotion e-mail', () => {
  const payload = { url: 'https://app.example.com/accounts' };

  it.each([
    ['pl', 'Jesteś Platyną w dMb Projekt 2027', 'Przejdź do aplikacji'],
    ['de', 'Sie sind Platin in dMb Projekt 2027', 'Zur Anwendung'],
    ['en', 'You are a Platinum in dMb Projekt 2027', 'Open the application'],
  ])('is written in %s', (locale, subject, action) => {
    const mail = renderMail('promoted', payload, locale, 'p@b.pl');
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain(`${action}: ${payload.url}`);
    expect(mail.html).toContain(`href="${payload.url}"`);
  });

  it('falls back to Polish for an unknown language', () => {
    expect(renderMail('promoted', payload, 'fr', 'p@b.pl').subject).toContain(
      'Platyną',
    );
  });
});
