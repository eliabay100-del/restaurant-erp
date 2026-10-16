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
  createdAt: string | Date;
  updatedAt: string | Date;
  staff: { name: string; nameAm: string | null; role?: string };
  items: OrderItemView[];
}
