import { describe, expect, it } from 'vitest';
import { formatKgMilli, formatSenAsRM, shortFingerprint } from './format';

describe('format helpers', () => {
  it('formatSenAsRM', () => {
    expect(formatSenAsRM(25500)).toBe('RM255.00');
    expect(formatSenAsRM(0)).toBe('RM0.00');
    expect(formatSenAsRM(12345)).toBe('RM123.45');
    expect(formatSenAsRM(5)).toBe('RM0.05');
    expect(formatSenAsRM(-990)).toBe('-RM9.90');
  });
  it('formatKgMilli', () => {
    expect(formatKgMilli(9950)).toBe('9.950kg');
    expect(formatKgMilli(15000)).toBe('15kg');
    expect(formatKgMilli(0)).toBe('0kg');
    expect(formatKgMilli(1200)).toBe('1.200kg');
    expect(formatKgMilli(5)).toBe('0.005kg');
  });
  it('shortFingerprint', () => {
    expect(shortFingerprint('abc')).toBe('abc');
    expect(shortFingerprint('DEV-FP:HP-SNAP-001:r1')).toBe('DEV-FP:HP-…');
  });
});
