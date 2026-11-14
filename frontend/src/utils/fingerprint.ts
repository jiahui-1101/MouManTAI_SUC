/**
 * Deterministic content fingerprint for snapshots.
 *
 * FNV-1a 64-bit over canonical JSON (sorted keys). This is a change-detection
 * fingerprint, NOT a cryptographic digest, and is labelled "fnv1a64:" so it is
 * never mistaken for SHA-256.
 */

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

export function fingerprint(value: unknown): string {
  let hash = FNV_OFFSET;
  const bytes = new TextEncoder().encode(canonicalJson(value));
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}
