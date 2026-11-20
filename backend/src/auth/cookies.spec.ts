import { parseCookies } from './cookies.js';

describe('parseCookies', () => {
  it('reads several cookies', () => {
    expect(parseCookies('sid=abc; theme=dark')).toEqual({
      sid: 'abc',
      theme: 'dark',
    });
  });

  it('returns nothing for a missing or empty header', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('decodes percent-encoding and keeps "=" inside values', () => {
    expect(parseCookies('a=x%20y; b=c=d')).toEqual({ a: 'x y', b: 'c=d' });
  });

  it('keeps the first value when a name repeats', () => {
    expect(parseCookies('sid=first; sid=second')).toEqual({ sid: 'first' });
  });

  it('ignores junk and survives malformed encoding', () => {
    expect(parseCookies('novalue; =empty; ok=1; bad=%E0%A4%A')).toEqual({
      ok: '1',
      bad: '%E0%A4%A',
    });
  });
});
