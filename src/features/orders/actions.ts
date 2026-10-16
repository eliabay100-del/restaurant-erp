'use server';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { authorize, ALL_ROLES, FLOOR_ROLES, MANAGEMENT_ROLES } from '@/lib/auth';
import { TAX_RATE, computeOrderTotals, parseMoney, roundMoney } from '@/lib/money';
import {
  ACTIVE_ORDER_STATUSES,
  ORDER_STATUSES,
  READY_FOR_PICKUP,
  isOrderItemStatus,
  isOrderStatus,
} from '@/lib/orderStatus';

interface CreateOrderInput {
  type: string;
  tableNumber?: string;
  note?: string;
  /** Whole-amount discount in ETB. Only management may set it. */
  discount?: number;
  items: {
    menuItemId: number;
    variantId?: number;
    quantity: number;
    note?: string;
    overridePrice?: number;
  }[];
}

const ORDER_TYPES = ['DINE_IN', 'TAKEOUT'];

export async function createOrder(input: CreateOrderInput) {
  try {
    const auth = await authorize(FLOOR_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const cookieStore = await cookies();
    const staffId = auth.session.staffId;
    const shiftId = parseInt(cookieStore.get('shiftId')?.value || '0');

    if (!shiftId) {
      return { success: false, error: 'No active shift' };
    }

    if (!ORDER_TYPES.includes(input.type)) {
      return { success: false, error: 'Invalid order type' };
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      return { success: false, error: 'Order must contain at least one item' };
    }
    if (input.items.some((i) => !Number.isFinite(i.quantity) || i.quantity <= 0)) {
      return { success: false, error: 'Item quantities must be greater than zero' };
    }

    // Only management may override a menu price (custom fees / comps) or grant
    // a bill-level discount.
    const isManagement = MANAGEMENT_ROLES.includes(auth.session.role);
    const canOverridePrice = isManagement;
    if (!canOverridePrice && input.items.some((i) => i.overridePrice !== undefined)) {
      return { success: false, error: 'Not authorized to override prices' };
    }

    let discount = 0;
    if (input.discount !== undefined) {
      const parsedDiscount = parseMoney(input.discount);
      if (parsedDiscount === null || parsedDiscount < 0) {
        return { success: false, error: 'Discount must be a positive amount' };
      }
      if (!isManagement) {
        return { success: false, error: 'Not authorized to apply a discount' };
      }
      discount = parsedDiscount;
    }

    // Get menu items and variants for price snapshot
    const menuItemIds = input.items.map((i) => i.menuItemId);
    const variantIds = input.items.map((i) => i.variantId).filter(Boolean) as number[];
    
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });
    const variants = await prisma.menuVariant.findMany({
      where: { id: { in: variantIds } },
    });

    const menuItemMap = new Map(menuItems.map((mi) => [mi.id, mi]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Generate order number (daily sequential)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrderCount = await prisma.order.count({
      where: { createdAt: { gte: today } },
    });
    const orderNumber = `${today.toISOString().slice(0, 10).replace(/-/g, '')}-${String(todayOrderCount + 1).padStart(3, '0')}`;

    // Build order items with price snapshots
    const orderItems = input.items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
      
      let unitPrice = menuItem.price;
      let itemNameEn = menuItem.nameEn;
      let itemNameAm = menuItem.nameAm;

      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (variant) {
          unitPrice += variant.priceOffset;
          itemNameEn = `${menuItem.nameEn} (${variant.nameEn})`;
          if (menuItem.nameAm && variant.nameAm) {
            itemNameAm = `${menuItem.nameAm} (${variant.nameAm})`;
          }
        }
      }

      // Allow override price for custom fees
      if (item.overridePrice !== undefined) {
        unitPrice = item.overridePrice;
      }

      return {
        menuItemId: item.menuItemId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice,
        itemNameEn,
        itemNameAm,
        totalPrice: unitPrice * item.quantity,
        note: item.note,
        status: 'PENDING',
      };
    });

    // Calculate totals — the discount comes off before VAT.
    const taxRate = TAX_RATE;
    const { subtotal, discount: appliedDiscount, taxAmount, total } = computeOrderTotals(
      orderItems.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity })),
      discount,
      taxRate,
    );

    // Create order with items
    const order = await prisma.order.create({
      data: {
        orderNumber,
        type: input.type,
        status: 'PENDING',
        tableNumber: input.tableNumber,
        staffId,
        shiftId,
        subtotal,
        taxRate,
        taxAmount,
        discount: appliedDiscount,
        total,
        note: input.note,
        items: {
          create: orderItems.map((i) => ({ ...i, totalPrice: roundMoney(i.totalPrice) })),
        },
      },
      include: {
        items: {
          include: { menuItem: true },
        },
        staff: {
          select: { name: true, nameAm: true },
        },
      },
    });

    return { success: true, order };
  } catch (error) {
    console.error('Create order error:', error);
    return { success: false, error: 'Failed to create order' };
  }
}

export async function updateOrderStatus(orderId: number, status: string) {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (!isOrderStatus(status)) {
      return { success: false, error: `Unknown order status: ${status}` };
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        items: {
          // CANCELLED keeps the item-level value consistent with the order.
          updateMany: {
            where: { orderId },
            data: { status: isOrderItemStatus(status) ? status : 'CANCELLED' },
          },
        },
      },
      include: {
        items: true,
        staff: { select: { name: true, nameAm: true } },
      },
    });

    return { success: true, order };
  } catch (error) {
    console.error('Update order status error:', error);
    return { success: false, error: 'Failed to update order status' };
  }
}

export async function updateOrderItemStatus(orderItemId: number, status: string) {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (!isOrderItemStatus(status)) {
      return { success: false, error: `Unknown item status: ${status}` };
    }

    const item = await prisma.orderItem.update({
      where: { id: orderItemId },
      data: { status },
    });

    // Roll the order up: every item done → READY, some started → PREPARING.
    const allItems = await prisma.orderItem.findMany({
      where: { orderId: item.orderId },
    });

    if (allItems.every((i) => i.status === status)) {
      await prisma.order.update({
        where: { id: item.orderId },
        data: { status },
      });
    }

    return { success: true, item };
  } catch (error) {
    console.error('Update item status error:', error);
    return { success: false, error: 'Failed to update item status' };
  }
}

export async function getUnpaidOrders() {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, orders: [] };

    const orders = await prisma.order.findMany({
      where: {
        payment: null,
        status: { not: 'CANCELLED' }
      },
      include: {
        items: true,
        staff: { select: { name: true, nameAm: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, orders };
  } catch (error) {
    console.error('Get unpaid orders error:', error);
    return { success: false, error: 'Failed to fetch unpaid orders', orders: [] };
  }
}

export async function getReadyOrders() {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, orders: [] };

    const orders = await prisma.order.findMany({
      where: {
        // "READY" = kitchen finished, waiting to be picked up / served.
        status: READY_FOR_PICKUP,
      },
      include: {
        items: true,
        staff: { select: { name: true, nameAm: true, role: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return { success: true, orders };
  } catch (error) {
    console.error('Get ready orders error:', error);
    return { success: false, error: 'Failed to fetch ready orders', orders: [] };
  }
}

export async function getActiveOrders() {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, orders: [] };

    const orders = await prisma.order.findMany({
      where: {
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
      include: {
        items: true,
        staff: { select: { name: true, nameAm: true } },
        payment: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { success: true, orders };
  } catch (error) {
    console.error('Get active orders error:', error);
    return { success: false, error: 'Failed to fetch orders', orders: [] };
  }
}

export async function getOrderHistory(page: number = 1, limit: number = 20, status?: string) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, orders: [], total: 0, pages: 0 };

    if (status && !(ORDER_STATUSES as readonly string[]).includes(status)) {
      return { success: false, error: `Unknown order status: ${status}`, orders: [], total: 0, pages: 0 };
    }

    const where = status ? { status } : {};
    const [orders, total] = await Promise.all([      prisma.order.findMany({
        where,
        include: {
          items: true,
          staff: { select: { name: true, nameAm: true } },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { success: true, orders, total, pages: Math.ceil(total / limit) };
  } catch (error) {
    console.error('Get order history error:', error);
    return { success: false, error: 'Failed to fetch order history', orders: [], total: 0, pages: 0 };
  }
}

export async function cancelOrder(orderId: number) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const staffId = auth.session.staffId;

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        items: {
          updateMany: {
            where: { orderId },
            data: { status: 'CANCELLED' },
          },
        },
      },
    });

    // Log the cancellation
    await prisma.auditLog.create({
      data: {
        staffId,
        action: 'ORDER_CANCEL',
        details: JSON.stringify({ orderId, orderNumber: order.orderNumber }),
      },
    });

    return { success: true, order };
  } catch (error) {
    console.error('Cancel order error:', error);
    return { success: false, error: 'Failed to cancel order' };
  }
}
