'use server';

import { prisma } from '@/lib/prisma';
import { authorize, MANAGEMENT_ROLES } from '@/lib/auth';
import { roundMoney } from '@/lib/money';
import { businessDayStart, businessDayFromInput, businessMonthStart, businessDayKey, businessHour } from '@/lib/time';

export async function getDailyReport(date?: string) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const targetDate = date ? (businessDayFromInput(date) ?? new Date(date)) : businessDayStart();
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    const [orders, payments] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: { gte: targetDate, lt: nextDay },
          status: { not: 'CANCELLED' },
        },
        include: {
          items: true,
          payment: true,
          staff: { select: { name: true, nameAm: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.payment.findMany({
        where: { createdAt: { gte: targetDate, lt: nextDay }, amountPaid: { gt: 0 } },
      }),
    ]);

    const totalRevenue = payments.reduce((s, p) => s + p.amountDue, 0);
    const cashRevenue = payments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amountDue, 0);
    const cardRevenue = payments.filter(p => p.method === 'CARD').reduce((s, p) => s + p.amountDue, 0);
    const mobileRevenue = payments.filter(p => p.method === 'MOBILE').reduce((s, p) => s + p.amountDue, 0);

    // Top selling items (SQL groupBy; exclude fee lines)
    const feeItems = await prisma.menuItem.findMany({ where: { kind: 'FEE' }, select: { id: true } });
    const feeIds = feeItems.map((f) => f.id);
    const grouped = await prisma.orderItem.groupBy({
      by: ['itemNameEn'],
      where: {
        order: { createdAt: { gte: targetDate, lt: nextDay }, status: { not: 'CANCELLED' } },
        menuItemId: { notIn: feeIds.length ? feeIds : [0] },
      },
      _sum: { quantity: true, totalPrice: true },
      _max: { itemNameAm: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });
    const topItems = grouped.map((g) => ({
      nameEn: g.itemNameEn,
      nameAm: g._max.itemNameAm ?? null,
      qty: g._sum.quantity ?? 0,
      revenue: roundMoney(g._sum.totalPrice ?? 0),
    }));

    // Hourly breakdown
    const hourlyMap: Record<number, number> = {};
    for (const p of payments) {
      const hour = businessHour(new Date(p.createdAt));
      hourlyMap[hour] = (hourlyMap[hour] || 0) + p.amountDue;
    }

    return {
      success: true,
      date: targetDate.toISOString(),
      totalOrders: orders.length,
      cancelledOrders: 0,
      totalRevenue,
      cashRevenue,
      cardRevenue,
      mobileRevenue,
      avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
      topItems,
      hourlyRevenue: hourlyMap,
    };
  } catch (error) {
    console.error('Daily report error:', error);
    return { success: false, error: 'Failed to generate report' };
  }
}

export async function getWeeklyReport() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const today = businessDayStart();
    const weekEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
    const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const weekRange = { gte: weekStart, lte: weekEnd };

    const payments = await prisma.payment.findMany({
      where: { createdAt: weekRange, amountPaid: { gt: 0 } },
    });

    // Daily revenue for the week
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dailyMap[businessDayKey(d)] = 0;
    }
    for (const p of payments) {
      const day = businessDayKey(new Date(p.createdAt));
      if (dailyMap[day] !== undefined) dailyMap[day] += p.amountDue;
    }

    const totalRevenue = payments.reduce((s, p) => s + p.amountDue, 0);
    const cashRevenue = payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amountDue, 0);
    const cardRevenue = payments.filter((p) => p.method === 'CARD').reduce((s, p) => s + p.amountDue, 0);
    const mobileRevenue = payments.filter((p) => p.method === 'MOBILE').reduce((s, p) => s + p.amountDue, 0);

    const totalOrders = await prisma.order.count({
      where: { createdAt: weekRange, status: { not: 'CANCELLED' } },
    });

    // Top selling items this week (SQL groupBy, exclude fee lines)
    const feeItems = await prisma.menuItem.findMany({ where: { kind: 'FEE' }, select: { id: true } });
    const feeIds = feeItems.map((f) => f.id);
    const grouped = await prisma.orderItem.groupBy({
      by: ['itemNameEn'],
      where: {
        order: { createdAt: weekRange, status: { not: 'CANCELLED' } },
        menuItemId: { notIn: feeIds.length ? feeIds : [0] },
      },
      _sum: { quantity: true, totalPrice: true },
      _max: { itemNameAm: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });
    const topItems = grouped.map((g) => ({
      nameEn: g.itemNameEn,
      nameAm: g._max.itemNameAm ?? null,
      qty: g._sum.quantity ?? 0,
      revenue: roundMoney(g._sum.totalPrice ?? 0),
    }));

    return {
      success: true,
      totalRevenue,
      totalOrders,
      cashRevenue,
      cardRevenue,
      mobileRevenue,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      avgDailyRevenue: totalRevenue / 7,
      dailyRevenue: dailyMap,
      topItems,
    };
  } catch (error) {
    console.error('Weekly report error:', error);
    return { success: false, error: 'Failed to generate weekly report' };
  }
}

export async function getMonthlyReport() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const today = new Date();
    const monthStart = businessMonthStart(today);

    const payments = await prisma.payment.findMany({
      where: { createdAt: { gte: monthStart, lte: today }, amountPaid: { gt: 0 } },
    });

    const totalRevenue = payments.reduce((s, p) => s + p.amountDue, 0);
    const cashRevenue = payments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amountDue, 0);
    const cardRevenue = payments.filter(p => p.method === 'CARD').reduce((s, p) => s + p.amountDue, 0);
    const mobileRevenue = payments.filter(p => p.method === 'MOBILE').reduce((s, p) => s + p.amountDue, 0);

    const totalOrders = await prisma.order.count({
      where: { createdAt: { gte: monthStart, lte: today }, status: { not: 'CANCELLED' } },
    });

    // Top items this month (SQL groupBy, exclude fee lines)
    const feeItems = await prisma.menuItem.findMany({ where: { kind: 'FEE' }, select: { id: true } });
    const feeIds = feeItems.map((f) => f.id);
    const grouped = await prisma.orderItem.groupBy({
      by: ['itemNameEn'],
      where: {
        order: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
        menuItemId: { notIn: feeIds.length ? feeIds : [0] },
      },
      _sum: { quantity: true, totalPrice: true },
      _max: { itemNameAm: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });
    const topItems = grouped.map((g) => ({
      nameEn: g.itemNameEn,
      nameAm: g._max.itemNameAm ?? null,
      qty: g._sum.quantity ?? 0,
      revenue: roundMoney(g._sum.totalPrice ?? 0),
    }));

    return {
      success: true,
      month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
      totalRevenue,
      cashRevenue,
      cardRevenue,
      mobileRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      topItems,
    };
  } catch (error) {
    console.error('Monthly report error:', error);
    return { success: false, error: 'Failed to generate monthly report' };
  }
}
