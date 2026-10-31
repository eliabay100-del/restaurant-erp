/**
 * Business-day helpers.
 *
 * Timestamps are stored in UTC, but "today", the daily report and the sales
 * chart must follow the restaurant's wall clock (Addis Ababa, fixed UTC+3 with
 * no DST). Using the server's local timezone silently shifts every day bucket
 * when the app runs on a UTC host.
 */
const BUSINESS_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function wallClock(date: Date): Date {
  return new Date(date.getTime() + BUSINESS_UTC_OFFSET_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Instant of the most recent local (Addis) midnight. */
export function businessDayStart(date: Date = new Date()): Date {
  const wall = wallClock(date);
  return new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) - BUSINESS_UTC_OFFSET_MS
  );
}

/** Start of the local month containing `date`. */
export function businessMonthStart(date: Date = new Date()): Date {
  const wall = wallClock(date);
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1) - BUSINESS_UTC_OFFSET_MS);
}

/** Local `YYYY-MM-DD` key for a stored timestamp. */
export function businessDayKey(date: Date): string {
  const wall = wallClock(date);
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`;
}

/** Local `YYYYMMDD` stamp used in order numbers. */
export function businessDayStamp(date: Date = new Date()): string {
  return businessDayKey(date).replace(/-/g, '');
}

/** Local hour (0–23) for a stored timestamp. */
export function businessHour(date: Date): number {
  return wallClock(date).getUTCHours();
}

/** Parse a `YYYY-MM-DD` input as local midnight. */
export function businessDayFromInput(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)) - BUSINESS_UTC_OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Local `YYYY-MM-DD` key for a Date (used to label "today" inputs). */
export function todayInputValue(date: Date = new Date()): string {
  return businessDayKey(date);
}
