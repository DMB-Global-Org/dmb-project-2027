import { MAX_ATTEMPTS, retryDelayMs } from './outbox-dispatcher.js';

const MINUTE_MS = 60_000;

describe('retry schedule', () => {
  it('waits longer after every failure', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([
      1 * MINUTE_MS,
      5 * MINUTE_MS,
      30 * MINUTE_MS,
      120 * MINUTE_MS,
    ]);
  });

  it('never runs out of delays, whatever the attempt number', () => {
    expect(retryDelayMs(MAX_ATTEMPTS)).toBeGreaterThan(0);
    expect(retryDelayMs(99)).toBe(120 * MINUTE_MS);
  });
});
