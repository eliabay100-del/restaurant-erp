import { prisma } from '@/lib/prisma'

/**
 * Per-item consumption derived from the yield definition.
 *
 * The recipe editor stores "how many menu items one weighed/counted stock
 * produces" (e.g. 1000 g beans -> 100 cups). `quantity` is the integer
 * per-item consumption used by the append-only stock ledger. Recipes created
 * before the yield editor have no yield fields, so `quantity` is used as-is.
 */
export function perUnitConsumption(ingredient: {
  quantity: number
  yieldStockQuantity?: number | null
  yieldUnits?: number | null
}): number {
  const stock = ingredient.yieldStockQuantity
  const units = ingredient.yieldUnits
  if (stock !== null && stock !== undefined && units !== null && units !== undefined && units > 0 && stock > 0) {
    return Math.max(1, Math.round(stock / units))
  }
  return ingredient.quantity
}

/** Exact (unrounded) per-item consumption, for display only. */
export function exactPerUnitConsumption(ingredient: {
  quantity: number
  yieldStockQuantity?: number | null
  yieldUnits?: number | null
}): number {
  const stock = ingredient.yieldStockQuantity
  const units = ingredient.yieldUnits
  if (stock !== null && stock !== undefined && units !== null && units !== undefined && units > 0 && stock > 0) {
    return stock / units
  }
  return ingredient.quantity
}

export async function recordUsageForOrder(orderId: number, shiftId?: number) {
  // idempotent: if USAGE movements already exist for this order, skip
  const [existing, order] = await Promise.all([
    prisma.inventoryTransaction.findFirst({
      where: { reason: `order:${orderId}`, type: 'USAGE' },
      select: { id: true },
    }),
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        shiftId: true,
        staffId: true,
        items: { select: { menuItemId: true, quantity: true } },
      },
    }),
  ])
  if (existing) return { skipped: true }
  if (!order) throw new Error('order not found')

  const menuItemIds = [...new Set(order.items.map((line) => line.menuItemId))]
  const recipes = menuItemIds.length
    ? await prisma.recipeIngredient.findMany({
        where: { menuItemId: { in: menuItemIds } },
        select: {
          menuItemId: true,
          inventoryItemId: true,
          quantity: true,
          yieldStockQuantity: true,
          yieldUnits: true,
        },
      })
    : []

  const recipesByMenuItem = new Map<number, typeof recipes>()
  for (const recipe of recipes) {
    const list = recipesByMenuItem.get(recipe.menuItemId)
    if (list) list.push(recipe)
    else recipesByMenuItem.set(recipe.menuItemId, [recipe])
  }

  // Aggregate all lines per stock item so the ledger write is one INSERT
  // instead of one transaction per recipe line.
  const usage = new Map<number, number>()
  for (const line of order.items) {
    for (const recipe of recipesByMenuItem.get(line.menuItemId) ?? []) {
      const quantity = Math.abs(perUnitConsumption(recipe) * line.quantity)
      usage.set(recipe.inventoryItemId, (usage.get(recipe.inventoryItemId) ?? 0) + quantity)
    }
  }

  if (usage.size === 0) return { skipped: true, reason: 'no recipes' }

  // Ledger write and the derived currentStock cache move together — otherwise
  // inventory slowly drifts away from the recipe-derived usage.
  const created = await prisma.$transaction(async (tx) => {
    const result = await tx.inventoryTransaction.createMany({
      data: [...usage].map(([inventoryItemId, quantity]) => ({
        inventoryItemId,
        type: 'USAGE',
        quantity: -quantity, // usage reduces stock
        shiftId: shiftId ?? order.shiftId ?? null,
        reason: `order:${orderId}`,
        staffId: order.staffId ?? null,
      })),
    })
    for (const [inventoryItemId, quantity] of usage) {
      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { currentStock: { decrement: quantity } },
      })
    }
    return result
  })
  return { skipped: false, count: created.count }
}

export async function expectedUsageForShift(shiftId: number): Promise<Record<number, number>> {
  // sum usage per stock item for orders in this shift
  const moves = await prisma.inventoryTransaction.findMany({ where: { shiftId, type: 'USAGE' } })
  const out: Record<number, number> = {}
  for (const m of moves) {
    out[m.inventoryItemId] = (out[m.inventoryItemId] || 0) + Math.abs(m.quantity)
  }
  return out
}

export interface PeriodOrderUsageLine {
  inventoryItemId: number
  nameEn: string
  nameAm: string | null
  unit: string
  quantity: number
}

export interface PeriodOrderUsage {
  id: number
  orderNumber: string
  status: string
  paymentStatus: string
  type: string
  createdAt: Date
  confirmedAt: Date | null
  staffName: string | null
  kitchenStatus: string | null
  items: { nameEn: string; nameAm: string | null; quantity: number }[]
  usage: PeriodOrderUsageLine[]
}

/**
 * Expected ingredient usage for every order that reached the kitchen/barista
 * inside a time window.
 *
 * "Reached the kitchen" means the kitchen confirmed the order (confirmedAt is
 * set). Only order lines flagged `requiresTicket` are counted so fee lines
 * (delivery/cup fees) never consume stock.
 */
export async function expectedUsageForPeriod(
  periodStart: Date,
  periodEnd: Date
): Promise<{ orders: PeriodOrderUsage[]; totals: Record<number, number> }> {
  // The window is the kitchen window: an order belongs to the period in which
  // it was confirmed, not the (possibly earlier) moment it was opened.
  const orders = await prisma.order.findMany({
    where: {
      confirmedAt: { gte: periodStart, lte: periodEnd },
      status: { not: 'CANCELLED' },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      type: true,
      createdAt: true,
      confirmedAt: true,
      staff: { select: { name: true } },
      items: {
        where: { requiresTicket: true },
        select: {
          itemNameEn: true,
          itemNameAm: true,
          quantity: true,
          requiresTicket: true,
          menuItem: {
            select: {
              ingredients: {
                select: {
                  inventoryItemId: true,
                  quantity: true,
                  yieldStockQuantity: true,
                  yieldUnits: true,
                  inventoryItem: { select: { nameEn: true, nameAm: true, unit: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { confirmedAt: 'asc' },
  })

  const totals: Record<number, number> = {}
  const mapped: PeriodOrderUsage[] = orders.map((order) => {
    const usageMap = new Map<number, PeriodOrderUsageLine>()
    for (const line of order.items) {
      if (!line.requiresTicket) continue
      for (const ingredient of line.menuItem.ingredients) {
        const qty = perUnitConsumption(ingredient) * line.quantity
        if (qty <= 0) continue
        const existing = usageMap.get(ingredient.inventoryItemId)
        if (existing) {
          existing.quantity += qty
        } else {
          usageMap.set(ingredient.inventoryItemId, {
            inventoryItemId: ingredient.inventoryItemId,
            nameEn: ingredient.inventoryItem.nameEn,
            nameAm: ingredient.inventoryItem.nameAm,
            unit: ingredient.inventoryItem.unit,
            quantity: qty,
          })
        }
        totals[ingredient.inventoryItemId] = (totals[ingredient.inventoryItemId] ?? 0) + qty
      }
    }
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      type: order.type,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      staffName: order.staff?.name ?? null,
      kitchenStatus: order.confirmedAt ? order.status : null,
      items: order.items.map((item) => ({
        nameEn: item.itemNameEn,
        nameAm: item.itemNameAm,
        quantity: item.quantity,
      })),
      usage: [...usageMap.values()],
    }
  })

  return { orders: mapped, totals }
}

/** Assignments that exactly match a period window. */
export async function getAssignmentsForPeriod(periodStart: Date, periodEnd: Date) {
  return prisma.stockAssignment.findMany({
    where: { periodStart, periodEnd },
    include: {
      inventoryItem: { select: { id: true, nameEn: true, nameAm: true, unit: true, currentStock: true } },
      assignedBy: { select: { name: true } },
    },
    orderBy: { inventoryItem: { nameEn: 'asc' } },
  })
}

/**
 * Upsert/remove assignments for a period. Assignments are planning records
 * (a quantity budget for the bar/kitchen), so they do not mutate the stock
 * ledger or `currentStock`.
 */
export async function saveAssignmentsForPeriod(input: {
  periodType: string
  periodStart: Date
  periodEnd: Date
  staffId: number
  lines: { inventoryItemId: number; quantity: number; note?: string }[]
}) {
  const { periodType, periodStart, periodEnd, staffId, lines } = input
  return prisma.$transaction(async (tx) => {
    for (const line of lines) {
      if (line.quantity <= 0) {
        await tx.stockAssignment.deleteMany({
          where: { inventoryItemId: line.inventoryItemId, periodStart, periodEnd },
        })
        continue
      }
      await tx.stockAssignment.upsert({
        where: {
          inventoryItemId_periodStart_periodEnd: {
            inventoryItemId: line.inventoryItemId,
            periodStart,
            periodEnd,
          },
        },
        create: {
          inventoryItemId: line.inventoryItemId,
          quantity: Math.round(line.quantity),
          periodType,
          periodStart,
          periodEnd,
          note: line.note,
          assignedById: staffId,
        },
        update: {
          quantity: Math.round(line.quantity),
          periodType,
          note: line.note,
          assignedById: staffId,
        },
      })
    }
    return { saved: lines.length }
  })
}
