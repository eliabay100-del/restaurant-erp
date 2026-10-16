/**
 * Shared utilities for the warka-dine POS.
 */
import { computeOrderTotals, TAX_RATE } from '@/lib/money';
import type { OrderStatus } from '@/lib/orderStatus';

// Keep the re-exported constant used by legacy call sites.
export { TAX_RATE };

/**
 * Format a number as Ethiopian Birr currency
 */
export function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} ETB`;
}

/**
 * Format a number as Ethiopian Birr currency (Amharic)
 */
export function formatCurrencyAm(amount: number): string {
  return `${amount.toFixed(2)} ብር`;
}

/**
 * Format currency based on locale
 */
export function formatPrice(amount: number, locale: string = 'en'): string {
  if (locale === 'am') {
    return formatCurrencyAm(amount);
  }
  return formatCurrency(amount);
}

/**
 * Generate a daily-resetting order number
 * Format: ORD-YYYYMMDD-NNN
 */
export function generateOrderNumber(sequenceNumber: number): string {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  return `${dateStr}-${String(sequenceNumber).padStart(3, '0')}`;
}

/**
 * Calculate time elapsed since a given date
 */
export function getTimeElapsed(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

/**
 * Calculate time elapsed in minutes
 */
export function getMinutesElapsed(date: Date | string): number {
  const now = new Date();
  const past = new Date(date);
  return Math.floor((now.getTime() - past.getTime()) / 60000);
}

/**
 * Format a date as a human-readable string
 */
export function formatDate(date: Date | string, locale: string = 'en'): string {
  const d = new Date(date);
  return d.toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date and time
 */
export function formatDateTime(date: Date | string, locale: string = 'en'): string {
  const d = new Date(date);
  return d.toLocaleString(locale === 'am' ? 'am-ET' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format time only
 */
export function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get the bilingual name based on locale
 */
export function getLocaleName(nameEn: string, nameAm: string | null | undefined, locale: string = 'en'): string {
  if (locale === 'am' && nameAm) return nameAm;
  return nameEn;
}

/**
 * Calculate order totals
 */
export function calculateOrderTotals(items: { unitPrice: number; quantity: number }[], taxRate: number = TAX_RATE, discount: number = 0) {
  return computeOrderTotals(items, discount, taxRate);
}

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'var(--accent-blue)',
  PREPARING: 'var(--warning)',
  READY: 'var(--success)',
  SERVED: 'var(--text-muted)',
  CANCELLED: 'var(--danger)',
};

const ORDER_STATUS_BADGES: Record<OrderStatus, string> = {
  PENDING: 'badge-pending',
  PREPARING: 'badge-preparing',
  READY: 'badge-ready',
  SERVED: 'badge-served',
  CANCELLED: 'badge-cancelled',
};

/**
 * Order status color mapping
 */
export function getStatusColor(status: string): string {
  return ORDER_STATUS_COLORS[status as OrderStatus] ?? 'var(--text-secondary)';
}

/**
 * Get CSS class for status badge
 */
export function getStatusBadgeClass(status: string): string {
  return ORDER_STATUS_BADGES[status as OrderStatus] ?? 'badge-served';
}

/**
 * Staff role display names
 */
export const ROLE_LABELS: Record<string, { en: string; am: string }> = {
  ADMIN: { en: 'Admin', am: 'አድሚን' },
  MANAGER: { en: 'Manager', am: 'ሥራ አስኪያጅ' },
  CASHIER: { en: 'Cashier', am: 'ገንዘብ ተቀባይ' },
  KITCHEN: { en: 'Kitchen', am: 'ወጥ ቤት' },
  WAITER: { en: 'Waiter', am: 'አስተናጋጅ' },
};

/**
 * Order type labels
 */
export const ORDER_TYPE_LABELS: Record<string, { en: string; am: string }> = {
  DINE_IN: { en: 'Dine In', am: 'እዚህ መብላት' },
  TAKEOUT: { en: 'Takeout', am: 'ለመውሰድ' },
};

/**
 * Debounce utility
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: unknown[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  }) as T;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
