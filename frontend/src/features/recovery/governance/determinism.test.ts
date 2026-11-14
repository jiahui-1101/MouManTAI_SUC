import { describe, expect, it } from 'vitest';

/** Grep-style guard: P5 business logic must not read wall-clock time or randomness. */
const sources = import.meta.glob(['../../approvals/*.ts', '../../outcomes/*.ts', './*.ts', '!**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const BANNED = [/Date\.now\s*\(/, /Math\.random\s*\(/, /new Date\s*\(/, /\bfetch\s*\(/];

describe('determinism', () => {
  it('scans the P5 modules', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(12);
  });
  it.each(Object.entries(sources))('%s has no Date.now / Math.random / new Date / fetch', (_path, src) => {
    for (const re of BANNED) expect(src).not.toMatch(re);
  });
});
