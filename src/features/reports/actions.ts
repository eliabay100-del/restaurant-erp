'use server';

import { prisma } from '@/lib/prisma';
import { authorize, MANAGEMENT_ROLES } from '@/lib/auth';

export async function getDailyReport(date?: string) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

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
        where: { createdAt: { gte: targetDate, lt: nextDay } },
      }),
    ]);

    const totalRevenue = payments.reduce((s, p) => s + p.amountDue, 0);
    const cashRevenue = payments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amountDue, 0);
    const cardRevenue = payments.filter(p => p.method === 'CARD').reduce((s, p) => s + p.amountDue, 0);
    const mobileRevenue = payments.filter(p => p.method === 'MOBILE').reduce((s, p) => s + p.amountDue, 0);

    // Top selling items
    const itemMap: Record<string, { nameEn: string; nameAm: string | null; qty: number; revenue: number }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.itemNameEn;
        if (!itemMap[key]) {
          itemMap[key] = { nameEn: item.itemNameEn, nameAm: item.itemNameAm, qty: 0, revenue: 0 };
        }
        itemMap[key].qty += item.quantity;
        itemMap[key].revenue += item.totalPrice;
      }
    }
    const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Hourly breakdown
    const hourlyMap: Record<number, number> = {};
    for (const p of payments) {
      const hour = new Date(p.createdAt).getHours();
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

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const payments = await prisma.payment.findMany({
      where: { createdAt: { gte: weekStart, lte: today } },
      include: { order: { select: { createdAt: true } } },
    });

    // Daily revenue for the week
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const p of payments) {
      const day = new Date(p.createdAt).toISOString().slice(0, 10);
      if (dailyMap[day] !== undefined) dailyMap[day] += p.amountDue;
    }

    const totalRevenue = payments.reduce((s, p) => s + p.amountDue, 0);
    const totalOrders = await prisma.order.count({
      where: { createdAt: { gte: weekStart, lte: today }, status: { not: 'CANCELLED' } },
    });

    return {
      success: true,
      totalRevenue,
      totalOrders,
      avgDailyRevenue: totalRevenue / 7,
      dailyRevenue: dailyMap,
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
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const payments = await prisma.payment.findMany({
      where: { createdAt: { gte: monthStart, lte: today } },
    });

    const totalRevenue = payments.reduce((s, p) => s + p.amountDue, 0);
    const cashRevenue = payments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amountDue, 0);
    const cardRevenue = payments.filter(p => p.method === 'CARD').reduce((s, p) => s + p.amountDue, 0);
    const mobileRevenue = payments.filter(p => p.method === 'MOBILE').reduce((s, p) => s + p.amountDue, 0);

    const totalOrders = await prisma.order.count({
      where: { createdAt: { gte: monthStart, lte: today }, status: { not: 'CANCELLED' } },
    });

    // Top items this month
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
      include: { items: true },
    });
    const itemMap: Record<string, { nameEn: string; nameAm: string | null; qty: number; revenue: number }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.itemNameEn;
        if (!itemMap[key]) itemMap[key] = { nameEn: item.itemNameEn, nameAm: item.itemNameAm, qty: 0, revenue: 0 };
        itemMap[key].qty += item.quantity;
        itemMap[key].revenue += item.totalPrice;
      }
    }
    const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

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
