import type { LocalTime } from "../types/common";

/** "10:45" → 645 minutes after midnight (business-local). Throws on malformed input. */
export function localTimeToMinutes(time: LocalTime): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new Error(`Invalid local time "${time}" (expected HH:MM)`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** True when `at` is at or before `deadline` (same business day). */
export function isAtOrBefore(at: LocalTime, deadline: LocalTime): boolean {
  return localTimeToMinutes(at) <= localTimeToMinutes(deadline);
}
