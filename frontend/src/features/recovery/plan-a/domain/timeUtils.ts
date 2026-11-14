export function parseLocalMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(?:([01]\d|2[0-3])):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatLocalMinutes(value: number): string {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return daysInMonth !== undefined && day <= daysInMonth;
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function parseExplicitOffsetInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const pattern = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/;
  const match = pattern.exec(value);
  if (!match || !isCalendarDate(match[1])) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function instantMatchesBusinessClock(
  instant: string,
  businessDate: string,
  localTime: string,
  timeZone: string,
): boolean {
  const timestamp = parseExplicitOffsetInstant(instant);
  const localMinutes = parseLocalMinutes(localTime);
  if (timestamp === null || localMinutes === null || !isCalendarDate(businessDate) || !isValidTimeZone(timeZone)) return false;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const formattedDate = `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
  const formattedMinutes = Number(valueFor("hour")) * 60 + Number(valueFor("minute"));
  return formattedDate === businessDate && formattedMinutes === localMinutes;
}
