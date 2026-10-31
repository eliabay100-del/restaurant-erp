'use server';

import { prisma } from '@/lib/prisma';
import { authorize, MANAGEMENT_ROLES } from '@/lib/auth';
import {
  expectedUsageForShift,
  expectedUsageForPeriod,
  getAssignmentsForPeriod,
  saveAssignmentsForPeriod,
  perUnitConsumption,
  exactPerUnitConsumption,
} from '@/server/services/reconciliation.service';

const PERIOD_TYPES = ['DAY', 'WEEK', 'MONTH', 'CUSTOM'] as const;
const MAX_PERIOD_MS = 366 * 24 * 60 * 60 * 1000;

function parsePeriod(periodStart: string, periodEnd: string) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Invalid period dates' as const };
  }
  if (start >= end) return { error: 'Period start must be before end' as const };
  if (end.getTime() - start.getTime() > MAX_PERIOD_MS) {
    return { error: 'Period is too long' as const };
  }
  return { start, end };
}

// ============================================================================
// Section 1 — Recipe yield editor
// ============================================================================

export async function getRecipeEditorData() {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error, menuItems: [], inventoryItems: [] };

  const [menuItems, inventoryItems] = await Promise.all([
    prisma.menuItem.findMany({
      where: { kind: 'PRODUCT' },
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
      include: {
        category: { select: { id: true, nameEn: true, nameAm: true } },
        ingredients: {
          select: {
            id: true,
            inventoryItemId: true,
            quantity: true,
            yieldStockQuantity: true,
            yieldUnits: true,
            inventoryItem: { select: { nameEn: true, nameAm: true, unit: true } },
          },
        },
      },
    }),
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { nameEn: 'asc' },
      select: { id: true, nameEn: true, nameAm: true, unit: true, currentStock: true },
    }),
  ]);

  const rows = menuItems.map((item) => ({
    id: item.id,
    nameEn: item.nameEn,
    nameAm: item.nameAm,
    category: item.category,
    ingredients: item.ingredients.map((ing) => ({
      id: ing.id,
      inventoryItemId: ing.inventoryItemId,
      stockNameEn: ing.inventoryItem.nameEn,
      stockNameAm: ing.inventoryItem.nameAm,
      unit: ing.inventoryItem.unit,
      quantity: ing.quantity,
      yieldStockQuantity: ing.yieldStockQuantity,
      yieldUnits: ing.yieldUnits,
      exactPerUnit: exactPerUnitConsumption(ing),
      perUnit: perUnitConsumption(ing),
    })),
  }));

  return { success: true, menuItems: rows, inventoryItems };
}

export async function saveRecipeYield(input: {
  menuItemId: number;
  inventoryItemId: number;
  yieldStockQuantity: number;
  yieldUnits: number;
}) {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };

  const menuItemId = Number(input.menuItemId);
  const inventoryItemId = Number(input.inventoryItemId);
  const stockQty = Math.round(Number(input.yieldStockQuantity));
  const units = Math.round(Number(input.yieldUnits));

  if (!Number.isInteger(menuItemId) || menuItemId <= 0) return { success: false, error: 'Choose a menu item' };
  if (!Number.isInteger(inventoryItemId) || inventoryItemId <= 0) return { success: false, error: 'Choose a stock item' };
  if (!Number.isFinite(stockQty) || stockQty <= 0) return { success: false, error: 'Stock quantity must be greater than zero' };
  if (!Number.isFinite(units) || units <= 0) return { success: false, error: 'Units produced must be greater than zero' };

  const [menuItem, inventoryItem] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id: menuItemId }, select: { id: true } }),
    prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { id: true, unit: true } }),
  ]);
  if (!menuItem) return { success: false, error: 'Menu item not found' };
  if (!inventoryItem) return { success: false, error: 'Stock item not found' };

  // Derived integer per-item consumption used by the stock ledger.
  const quantity = Math.max(1, Math.round(stockQty / units));

  const existing = await prisma.recipeIngredient.findFirst({
    where: { menuItemId, inventoryItemId },
  });

  const data = {
    quantity,
    unit: inventoryItem.unit,
    yieldStockQuantity: stockQty,
    yieldUnits: units,
  };

  const ingredient = existing
    ? await prisma.recipeIngredient.update({ where: { id: existing.id }, data })
    : await prisma.recipeIngredient.create({
        data: { menuItemId, inventoryItemId, ...data },
      });

  return {
    success: true,
    ingredient: { ...ingredient, exactPerUnit: stockQty / units, perUnit: quantity },
    message: `${stockQty} ${inventoryItem.unit} yields ${units} item(s) — ${(stockQty / units).toFixed(2)} ${inventoryItem.unit} each.`,
  };
}

export async function deleteRecipeIngredient(id: number) {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };
  const ingredient = await prisma.recipeIngredient.findUnique({ where: { id } });
  if (!ingredient) return { success: false, error: 'Recipe line not found' };
  await prisma.recipeIngredient.delete({ where: { id } });
  return { success: true };
}

// ============================================================================
// Section 2 — Assign stock to a period
// ============================================================================

export async function getAssignmentBoard(periodStart: string, periodEnd: string) {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error, items: [] };

  const period = parsePeriod(periodStart, periodEnd);
  if ('error' in period) return { success: false, error: period.error, items: [] };

  const [inventoryItems, assignments] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { nameEn: 'asc' },
      select: { id: true, nameEn: true, nameAm: true, unit: true, currentStock: true, tracked: true },
    }),
    getAssignmentsForPeriod(period.start, period.end),
  ]);

  const byItem = new Map(assignments.map((a) => [a.inventoryItemId, a]));
  const items = inventoryItems.map((item) => {
    const assignment = byItem.get(item.id);
    return {
      id: item.id,
      nameEn: item.nameEn,
      nameAm: item.nameAm,
      unit: item.unit,
      currentStock: item.currentStock,
      tracked: item.tracked,
      assigned: assignment?.quantity ?? 0,
      note: assignment?.note ?? '',
      assignedByName: assignment?.assignedBy?.name ?? null,
    };
  });

  return { success: true, items, periodStart: period.start, periodEnd: period.end };
}

export async function saveStockAssignments(input: {
  periodType: string;
  periodStart: string;
  periodEnd: string;
  lines: { inventoryItemId: number; quantity: number; note?: string }[];
}) {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };

  const periodType = PERIOD_TYPES.includes(input.periodType as (typeof PERIOD_TYPES)[number])
    ? input.periodType
    : 'CUSTOM';
  const period = parsePeriod(input.periodStart, input.periodEnd);
  if ('error' in period) return { success: false, error: period.error };

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { success: false, error: 'Nothing to assign' };
  }

  const valid = input.lines.filter(
    (l) => Number.isInteger(l.inventoryItemId) && l.inventoryItemId > 0 && Number.isFinite(l.quantity) && l.quantity >= 0
  );
  if (valid.length === 0) return { success: false, error: 'No valid assignment lines' };

  await saveAssignmentsForPeriod({
    periodType,
    periodStart: period.start,
    periodEnd: period.end,
    staffId: auth.session.staffId,
    lines: valid.map((l) => ({
      inventoryItemId: l.inventoryItemId,
      quantity: Math.round(l.quantity),
      note: l.note,
    })),
  });

  return { success: true, message: 'Stock assigned for the selected period.' };
}

// ============================================================================
// Section 3 — Settlement
// ============================================================================

export async function getSettlement(periodStart: string, periodEnd: string) {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error, summary: [], orders: [] };

  const period = parsePeriod(periodStart, periodEnd);
  if ('error' in period) return { success: false, error: period.error, summary: [], orders: [] };

  const [{ orders, totals }, assignments] = await Promise.all([
    expectedUsageForPeriod(period.start, period.end),
    getAssignmentsForPeriod(period.start, period.end),
  ]);

  const assignedByItem = new Map(assignments.map((a) => [a.inventoryItemId, a.quantity]));
  const ids = new Set<number>([...assignedByItem.keys(), ...Object.keys(totals).map(Number)]);

  const items = ids.size
    ? await prisma.inventoryItem.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, nameEn: true, nameAm: true, unit: true },
      })
    : [];
  const itemById = new Map(items.map((i) => [i.id, i]));

  const summary = [...ids]
    .map((id) => {
      const item = itemById.get(id);
      const assigned = assignedByItem.get(id) ?? 0;
      const expected = totals[id] ?? 0;
      return {
        id,
        nameEn: item?.nameEn ?? `Item #${id}`,
        nameAm: item?.nameAm ?? null,
        unit: item?.unit ?? '',
        assigned,
        expected,
        // Positive = stock still on hand; negative = over-consumed vs assignment.
        remaining: assigned - expected,
      };
    })
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  return {
    success: true,
    periodStart: period.start,
    periodEnd: period.end,
    summary,
    orders,
    totals: {
      assigned: summary.reduce((s, r) => s + r.assigned, 0),
      expected: summary.reduce((s, r) => s + r.expected, 0),
      // Counts are safe to aggregate; quantity sums mix g/ml/pcs and are only
      // shown per row, never as one grand total.
      assignedItems: summary.filter((r) => r.assigned > 0).length,
      expectedItems: summary.filter((r) => r.expected > 0).length,
      orders: orders.length,
    },
  };
}

// ============================================================================
// Legacy shift reconciliation (kept for the shift close workflow)
// ============================================================================

export async function getOpenShifts() {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error, shifts: [] };
  const shifts = await prisma.shift.findMany({ where: { status: 'OPEN' }, orderBy: { startTime: 'desc' }, include: { staff: { select: { name: true } } } });
  return { success: true, shifts };
}

export async function getReconciliation(shiftId: number) {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return { success: false, error: 'shift not found' };
  const tracked = await prisma.inventoryItem.findMany({
    where: { tracked: true, isActive: true },
    select: { id: true, nameEn: true, unit: true },
  });
  const counts = await prisma.shiftStockCount.findMany({
    where: { shiftId },
    select: { stockItemId: true, assigned: true, expectedUsage: true, closingCount: true, variance: true },
  });
  const byItem = new Map(counts.map((c) => [c.stockItemId, c]));
  const usage = await expectedUsageForShift(shiftId);
  const items = tracked.map((it) => {
    const c = byItem.get(it.id);
    return {
      id: it.id,
      name: it.nameEn,
      unit: it.unit,
      assigned: c?.assigned ?? 0,
      expectedUsage: usage[it.id] ?? c?.expectedUsage ?? 0,
      closingCount: c?.closingCount ?? 0,
      variance: c?.variance ?? null,
    };
  });
  return { success: true, shift, items };
}

export async function saveReconciliation(shiftId: number, counts: { itemId: number; assigned: number; closingCount: number }[]) {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };
  const usage = await expectedUsageForShift(shiftId);
  await prisma.$transaction(
    counts.map((c) => {
      const expected = usage[c.itemId] ?? 0;
      const variance = c.assigned - expected - c.closingCount;
      return prisma.shiftStockCount.upsert({
        where: { shiftId_stockItemId: { shiftId, stockItemId: c.itemId } },
        create: { shiftId, stockItemId: c.itemId, assigned: c.assigned, expectedUsage: expected, closingCount: c.closingCount, variance },
        update: { assigned: c.assigned, expectedUsage: expected, closingCount: c.closingCount, variance },
      });
    })
  );
  await prisma.shift.update({ where: { id: shiftId }, data: { status: 'CLOSED', endTime: new Date() } });
  return { success: true };
}

export async function recordWaste(itemId: number, quantity: number, reason: string, shiftId: number) {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };
  const m = await prisma.inventoryTransaction.create({
    data: {
      inventoryItemId: itemId,
      type: 'WASTE',
      quantity: -Math.abs(quantity),
      shiftId,
      reason,
      staffId: auth.session.staffId,
    },
  });
  return { success: true, movement: m };
}

export async function getWastageSummary() {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error, rows: [] };
  const moves = await prisma.inventoryTransaction.findMany({
    where: { type: 'WASTE' },
    include: { inventoryItem: { select: { nameEn: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const staffIds = [...new Set(moves.map((m) => m.staffId).filter(Boolean))] as number[];
  const staffs = staffIds.length ? await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : [];
  const staffMap = new Map(staffs.map((s) => [s.id, s.name]));
  return { success: true, rows: moves.map((m) => ({ ...m, staff: m.staffId ? { name: staffMap.get(m.staffId) } : null })) };
}
