/**
 * Daily time-window price increases.
 *
 * The restaurant runs on Ethiopia time (Africa/Addis_Ababa, UTC+3, no DST).
 * All arithmetic stays in integer santim. A rule only changes the price while
 * its daily window is active; outside the window the base price is used again.
 */

export const BUSINESS_TIME_ZONE = 'Africa/Addis_Ababa';

export interface ScheduledPriceRule {
  scheduledIncrease: number;
  scheduledIncreaseStart: number;
  scheduledIncreaseEnd: number;
  scheduledIncreaseEnabled: boolean;
}

const addisTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Minutes from midnight in Addis Ababa for an instant. */
export function getAddisMinutes(now: Date = new Date()): number {
  const parts = addisTimeFormatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/** True when a daily window contains `minuteOfDay`. Handles windows across midnight. */
export function isMinuteInWindow(minuteOfDay: number, startMinute: number, endMinute: number): boolean {
  if (!Number.isInteger(minuteOfDay) || !Number.isInteger(startMinute) || !Number.isInteger(endMinute)) {
    return false;
  }
  if (startMinute < 0 || startMinute > 1439 || endMinute < 0 || endMinute > 1439) return false;
  if (startMinute === endMinute) return false;

  if (startMinute < endMinute) return minuteOfDay >= startMinute && minuteOfDay < endMinute;
  return minuteOfDay >= startMinute || minuteOfDay < endMinute;
}

/** Whether the rule is enabled and its daily window is active right now. */
export function isScheduledIncreaseActive(
  rule: Pick<ScheduledPriceRule, 'scheduledIncreaseEnabled' | 'scheduledIncreaseStart' | 'scheduledIncreaseEnd'>,
  now: Date = new Date(),
): boolean {
  if (!rule.scheduledIncreaseEnabled) return false;
  return isMinuteInWindow(getAddisMinutes(now), rule.scheduledIncreaseStart, rule.scheduledIncreaseEnd);
}

/** Amount in santim to add for this rule at `now`. */
export function getScheduledIncrease(
  rule: ScheduledPriceRule,
  now: Date = new Date(),
  kind: string = 'PRODUCT',
): number {
  // Fees must never inherit a product's late-night increase.
  if (kind !== 'PRODUCT') return 0;
  if (!Number.isFinite(rule.scheduledIncrease) || rule.scheduledIncrease <= 0) return 0;
  return isScheduledIncreaseActive(rule, now) ? Math.round(rule.scheduledIncrease) : 0;
}

/** Effective unit price for a plain item (or a variant with no parent rule). */
export function getEffectivePrice(
  basePrice: number,
  rule: ScheduledPriceRule,
  now: Date = new Date(),
  kind: string = 'PRODUCT',
): number {
  return basePrice + getScheduledIncrease(rule, now, kind);
}

/**
 * Effective price for an item/variant pair.
 *
 * The item's increase applies to every size. A variant's own increase is added
 * on top, so a size can have a smaller or larger bump than its parent.
 */
export function getEffectiveUnitPrice(
  menuItem: { price: number; kind?: string } & ScheduledPriceRule,
  variant?: ({ priceOffset: number } & ScheduledPriceRule) | null,
  now: Date = new Date(),
): number {
  const kind = menuItem.kind ?? 'PRODUCT';
  const base = menuItem.price + (variant?.priceOffset ?? 0);
  const itemIncrease = getScheduledIncrease(menuItem, now, kind);
  const variantIncrease = variant ? getScheduledIncrease(variant, now, kind) : 0;
  return base + itemIncrease + variantIncrease;
}

/** "HH:MM" (24h) -> minutes from midnight. Returns null for bad input. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Minutes from midnight -> "HH:MM" for time inputs. */
export function minutesToTime(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.trunc(minutes) : 0;
  const normalized = ((safe % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
