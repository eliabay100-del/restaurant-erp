/**
 * View-model types for the POS order lists.
 *
 * These are structural subsets of the Prisma payloads returned by the order
 * server actions, kept narrow so components only depend on the fields they
 * actually read.
 */

export interface OrderItemView {
  id: number;
  quantity: number;
  unitPrice: number;
  itemNameEn: string;
  itemNameAm: string | null;
  status: string;
  note: string | null;
}

export interface OrderView {
  id: number;
  orderNumber: string;
  type: string;
  status: string;
  tableNumber: string | null;
  note: string | null;
  /**
   * Stored bill total, including VAT and any discount. Never recompute this
   * from the items: item rows only carry unit price, so a sum of them is the
   * pre-VAT subtotal and would disagree with what the server charges.
   */
  total: number;
  subtotal?: number;
  taxAmount?: number;
  discount?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  staff: { name: string; nameAm: string | null; role?: string };
  items: OrderItemView[];
}
