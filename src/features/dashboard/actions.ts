'use server';

import { prisma } from '@/lib/prisma';
import { authorize, MANAGEMENT_ROLES } from '@/lib/auth';
import { ACTIVE_ORDER_STATUSES } from '@/lib/orderStatus';
import { roundMoney } from '@/lib/money';

export async function getDailySummary() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, data: null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      include: { payment: true },
    });

    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? totalSales / orderCount : 0;
    const activeOrders = orders.filter((o) => (ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status)).length;

    const cashSales = orders
      .filter((o) => o.payment?.method === 'CASH')
      .reduce((sum, o) => sum + o.total, 0);
    const cardSales = orders
      .filter((o) => o.payment?.method === 'CARD')
      .reduce((sum, o) => sum + o.total, 0);

    return {
      success: true,
      data: {
        totalSales: roundMoney(totalSales),
        orderCount,
        averageOrder: roundMoney(averageOrder),
        activeOrders,
        cashSales: roundMoney(cashSales),
        cardSales: roundMoney(cardSales),
      },
    };
  } catch (error) {
    console.error('Get daily summary error:', error);
    return { success: false, error: 'Failed to fetch summary', data: null };
  }
}

export async function getSalesByHour() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, data: [] };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      select: { createdAt: true, total: true },
    });

    // Group by hour
    const hourData: { hour: number; total: number; count: number }[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      total: 0,
      count: 0,
    }));

    orders.forEach((order) => {
      const hour = new Date(order.createdAt).getHours();
      hourData[hour].total += order.total;
      hourData[hour].count += 1;
    });

    return { success: true, data: hourData };
  } catch (error) {
    console.error('Get sales by hour error:', error);
    return { success: false, error: 'Failed to fetch sales data', data: [] };
  }
}

export async function getRecentOrders(limit: number = 10) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, orders: [] };

    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payment: true,
        staff: { select: { name: true, nameAm: true } },
      },
    });

    return { success: true, orders };
  } catch (error) {
    console.error('Get recent orders error:', error);
    return { success: false, error: 'Failed to fetch orders', orders: [] };
  }
}

export async function getShiftReports() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, shifts: [] };

    const shifts = await prisma.shift.findMany({
      orderBy: { startTime: 'desc' },
      take: 20,
      include: {
        staff: { select: { name: true, nameAm: true } },
        orders: {
          where: { status: { not: 'CANCELLED' } },
          include: { payment: true },
        },
      },
    });

    const shiftData = shifts.map((shift) => {
      const totalSales = shift.orders.reduce((sum, o) => sum + o.total, 0);
      const orderCount = shift.orders.length;
      const cashSales = shift.orders
        .filter((o) => o.payment?.method === 'CASH')
        .reduce((sum, o) => sum + o.total, 0);

      return {
        id: shift.id,
        staffName: shift.staff.name,
        staffNameAm: shift.staff.nameAm,
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime?.toISOString() || null,
        openingCash: shift.openingCash,
        closingCash: shift.closingCash,
        expectedCash: shift.expectedCash,
        difference: shift.closingCash && shift.expectedCash ? shift.closingCash - shift.expectedCash : null,
        status: shift.status,
        totalSales,
        orderCount,
        cashSales,
      };
    });

    return { success: true, shifts: shiftData };
  } catch (error) {
    console.error('Get shift reports error:', error);
    return { success: false, error: 'Failed to fetch shifts', shifts: [] };
  }
}
