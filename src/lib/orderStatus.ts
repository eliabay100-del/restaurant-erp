/**
 * Canonical status values.
 *
 * The kitchen display, the waiter screen and the cashier screen all read the
 * same order status, so the set is defined once here and validated on the
 * server before anything is written.
 */

export const ORDER_STATUSES = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** `READY` means "kitchen is done — ready for pickup/serving". */
export const READY_FOR_PICKUP: OrderStatus = 'READY';

export const ORDER_ITEM_STATUSES = ['PENDING', 'PREPARING', 'READY', 'SERVED'] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

/** Statuses that count as "still in progress" on dashboards and lists. */
export const ACTIVE_ORDER_STATUSES: readonly string[] = ['PENDING', 'PREPARING', 'READY'];

export const SHIFT_STATUSES = ['OPEN', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isOrderItemStatus(value: unknown): value is OrderItemStatus {
  return typeof value === 'string' && (ORDER_ITEM_STATUSES as readonly string[]).includes(value);
}
