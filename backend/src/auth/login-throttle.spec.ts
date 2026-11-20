import { LOGIN_WINDOW_MS, LoginThrottle } from './login-throttle.js';

describe('LoginThrottle', () => {
  const T0 = 1_000_000;

  it('does not block before the limit is reached', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 4; i++) throttle.recordFailure('email:a', T0);

    expect(throttle.isBlocked('email:a', 5, T0)).toBe(false);
  });

  it('blocks once the limit is reached', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 5; i++) throttle.recordFailure('email:a', T0);

    expect(throttle.isBlocked('email:a', 5, T0)).toBe(true);
  });

  it('counts each key on its own', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 5; i++) throttle.recordFailure('email:a', T0);

    expect(throttle.isBlocked('email:b', 5, T0)).toBe(false);
  });

  it('lets the key through again after the window', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 5; i++) throttle.recordFailure('email:a', T0);

    expect(throttle.isBlocked('email:a', 5, T0 + LOGIN_WINDOW_MS - 1)).toBe(
      true,
    );
    expect(throttle.isBlocked('email:a', 5, T0 + LOGIN_WINDOW_MS)).toBe(false);
  });

  it('starts a fresh window for a failure after the old one ended', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 5; i++) throttle.recordFailure('email:a', T0);
    throttle.recordFailure('email:a', T0 + LOGIN_WINDOW_MS + 1);

    expect(throttle.isBlocked('email:a', 5, T0 + LOGIN_WINDOW_MS + 1)).toBe(
      false,
    );
  });

  it('forgets the failures of a key on reset (successful login)', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 5; i++) throttle.recordFailure('email:a', T0);
    throttle.reset('email:a');

    expect(throttle.isBlocked('email:a', 5, T0)).toBe(false);
  });
});
