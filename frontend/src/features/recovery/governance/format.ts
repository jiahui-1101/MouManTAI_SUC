/**
 * Display formatting for integer units. No shared utils/money.ts or utils/quantity.ts exist yet.
 * TODO(G0): move to shared utils if the Integrator adds them.
 */

/** Integer sen → "RM255.00". */
export function formatSenAsRM(sen: number): string {
  const neg = sen < 0;
  const abs = Math.abs(Math.trunc(sen));
  const ringgit = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  return `${neg ? '-' : ''}RM${ringgit}.${cents}`;
}

/**
 * Integer grams (kgMilli) → kg. One style everywhere: whole kilograms print without decimals
 * ("15kg"), anything else prints three decimals ("9.950kg").
 */
export function formatKgMilli(kgMilli: number): string {
  const neg = kgMilli < 0;
  const abs = Math.abs(Math.trunc(kgMilli));
  const whole = Math.floor(abs / 1000);
  const frac = abs % 1000;
  const body = frac === 0 ? `${whole}` : `${whole}.${String(frac).padStart(3, '0')}`;
  return `${neg ? '-' : ''}${body}kg`;
}

/** Shortens a fingerprint for display; the full value goes in a title attribute. */
export function shortFingerprint(fp: string, keep = 10): string {
  return fp.length <= keep + 1 ? fp : `${fp.slice(0, keep)}…`;
}
