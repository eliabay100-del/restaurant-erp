'use server';

import { prisma } from '@/lib/prisma';
import { authorize, MANAGEMENT_ROLES, FLOOR_ROLES } from '@/lib/auth';
import { ACTIVE_ORDER_STATUSES } from '@/lib/orderStatus';
import { roundMoney } from '@/lib/money';
import { businessDayStart, businessMonthStart, businessDayKey, businessHour } from '@/lib/time';

export async function getDailySummary() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, data: null };

    const today = businessDayStart();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

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

    const today = businessDayStart();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

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
      const hour = businessHour(new Date(order.createdAt));
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

export async function getCashierBootstrap() {
  try {
    const auth = await authorize(FLOOR_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const [cats, items, unpaid, ready] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, nameEn: true, nameAm: true, icon: true, color: true } }),
      prisma.menuItem.findMany({ where: { isAvailable: true }, orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { nameEn: 'asc' }], select: { id: true, nameEn: true, nameAm: true, price: true, isAvailable: true, image: true, categoryId: true, kind: true, variants: { where: { isActive: true }, select: { id: true, nameEn: true, nameAm: true, priceOffset: true } } } }),
      prisma.order.findMany({ where: { payment: null, status: { not: 'CANCELLED' } }, include: { items: true, staff: { select: { name: true, nameAm: true, role: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.order.findMany({ where: { status: 'READY' }, include: { items: true, staff: { select: { name: true, nameAm: true } } }, orderBy: { createdAt: 'asc' } }),
    ]);

    return { success: true, categories: cats, items, unpaidOrders: unpaid, readyOrders: ready };
  } catch (error) {
    console.error('Get cashier bootstrap error:', error);
    return { success: false, error: 'Failed to fetch cashier bootstrap' };
  }
}

export async function getWaiterBootstrap() {
  try {
    const auth = await authorize(FLOOR_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const [cats, items, ready] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, nameEn: true, nameAm: true, icon: true, color: true } }),
      prisma.menuItem.findMany({ where: { isAvailable: true }, orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { nameEn: 'asc' }], select: { id: true, nameEn: true, nameAm: true, price: true, isAvailable: true, image: true, categoryId: true, kind: true, variants: { where: { isActive: true }, select: { id: true, nameEn: true, nameAm: true, priceOffset: true } } } }),
      prisma.order.findMany({ where: { status: 'READY' }, include: { items: true, staff: { select: { name: true, nameAm: true } } }, orderBy: { createdAt: 'asc' } }),
    ]);

    return { success: true, categories: cats, items, readyOrders: ready };
  } catch (error) {
    console.error('Get waiter bootstrap error:', error);
    return { success: false, error: 'Failed to fetch waiter bootstrap' };
  }
}

export async function getOverviewData() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const [summary, hourly, recent] = await Promise.all([
      getDailySummary(),
      getSalesByHour(),
      getRecentOrders(10),
    ]);

    return {
      success: true,
      data: {
        summary: summary.success ? summary.data : null,
        hourly: hourly.success ? hourly.data : [],
        recent: recent.success ? recent.orders : [],
      },
    };
  } catch (error) {
    console.error('Get overview data error:', error);
    return { success: false, error: 'Failed to fetch overview data' };
  }
}
export async function getShiftReports() {
  try {

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
