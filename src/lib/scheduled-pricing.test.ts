import { describe, expect, it } from 'vitest';
import {
  getAddisMinutes,
  getEffectiveUnitPrice,
  getScheduledIncrease,
  isMinuteInWindow,
  isScheduledIncreaseActive,
  minutesToTime,
  parseTimeToMinutes,
  type ScheduledPriceRule,
} from './scheduled-pricing';

function addisDate(minutes: number): Date {
  const utcMinutes = (((minutes - 180) % 1440) + 1440) % 1440;
  return new Date(Date.UTC(2026, 9, 28, Math.floor(utcMinutes / 60), utcMinutes % 60));
}

function rule(overrides: Partial<ScheduledPriceRule> = {}): ScheduledPriceRule {
  return {
    scheduledIncrease: 1500,
    scheduledIncreaseStart: 120,
    scheduledIncreaseEnd: 360,
    scheduledIncreaseEnabled: true,
    ...overrides,
  };
}

describe('scheduled pricing', () => {
  it('reads the Addis Ababa clock, not the server clock', () => {
    expect(getAddisMinutes(new Date('2026-10-28T23:00:00Z'))).toBe(120); // 02:00 EAT
    expect(getAddisMinutes(new Date('2026-10-28T22:59:00Z'))).toBe(119); // 01:59 EAT
    expect(getAddisMinutes(addisDate(0))).toBe(0);
    expect(getAddisMinutes(addisDate(1439))).toBe(1439);
  });

  it('handles normal and overnight windows', () => {
    expect(isMinuteInWindow(119, 120, 360)).toBe(false);
    expect(isMinuteInWindow(120, 120, 360)).toBe(true);
    expect(isMinuteInWindow(359, 120, 360)).toBe(true);
    expect(isMinuteInWindow(360, 120, 360)).toBe(false);

    expect(isMinuteInWindow(1319, 1320, 120)).toBe(false);
    expect(isMinuteInWindow(1320, 1320, 120)).toBe(true);
    expect(isMinuteInWindow(0, 1320, 120)).toBe(true);
    expect(isMinuteInWindow(119, 1320, 120)).toBe(true);
    expect(isMinuteInWindow(120, 1320, 120)).toBe(false);
  });

  it('applies the increase only inside the window', () => {
    const r = rule();
    expect(getScheduledIncrease(r, addisDate(119))).toBe(0);
    expect(getScheduledIncrease(r, addisDate(120))).toBe(1500);
    expect(getScheduledIncrease(r, addisDate(359))).toBe(1500);
    expect(getScheduledIncrease(r, addisDate(360))).toBe(0);
    expect(isScheduledIncreaseActive(r, addisDate(180))).toBe(true);
  });

  it('ignores disabled rules, zero amounts, and fee items', () => {
    expect(getScheduledIncrease(rule({ scheduledIncreaseEnabled: false }), addisDate(180))).toBe(0);
    expect(getScheduledIncrease(rule({ scheduledIncrease: 0 }), addisDate(180))).toBe(0);
    expect(getScheduledIncrease(rule(), addisDate(180), 'DELIVERY_FEE')).toBe(0);
  });

  it('adds the item and variant increases on top of the base price', () => {
    const item = {
      price: 5000,
      kind: 'PRODUCT',
      scheduledIncrease: 1000,
      scheduledIncreaseStart: 120,
      scheduledIncreaseEnd: 360,
      scheduledIncreaseEnabled: true,
    };
    const variant = {
      priceOffset: 500,
      scheduledIncrease: 250,
      scheduledIncreaseStart: 120,
      scheduledIncreaseEnd: 360,
      scheduledIncreaseEnabled: true,
    };

    expect(getEffectiveUnitPrice(item, null, addisDate(180))).toBe(6000);
    expect(getEffectiveUnitPrice(item, variant, addisDate(180))).toBe(6750);
    expect(getEffectiveUnitPrice(item, variant, addisDate(400))).toBe(5500);
  });

  it('parses and formats HH:MM values', () => {
    expect(parseTimeToMinutes('02:00')).toBe(120);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
    expect(parseTimeToMinutes('24:00')).toBeNull();
    expect(parseTimeToMinutes('2:5')).toBeNull();
    expect(minutesToTime(120)).toBe('02:00');
    expect(minutesToTime(1439)).toBe('23:59');
    expect(minutesToTime(1440)).toBe('00:00');
  });
});
