'use server';

import { prisma } from '@/lib/prisma';
import { authorize, MANAGEMENT_ROLES } from '@/lib/auth';
import { roundMoney } from '@/lib/money';

export async function getInventoryItems(category?: string) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, items: [] };

    const where = category ? { category, isActive: true } : { isActive: true };
    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { nameEn: 'asc' },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    return { success: true, items };
  } catch (error) {
    console.error('Get inventory error:', error);
    return { success: false, error: 'Failed to fetch inventory', items: [] };
  }
}

export async function createInventoryItem(data: {
  nameEn: string;
  nameAm?: string;
  category: string;
  unit: string;
  currentStock?: number;
  unitCost?: number;
  reorderLevel?: number;
  supplier?: string;
}) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const item = await prisma.inventoryItem.create({ data });
    return { success: true, item };
  } catch (error) {
    console.error('Create inventory item error:', error);
    return { success: false, error: 'Failed to create inventory item' };
  }
}

export async function updateInventoryItem(
  id: number,
  data: {
    nameEn?: string;
    nameAm?: string;
    category?: string;
    unit?: string;
    unitCost?: number;
    reorderLevel?: number;
    supplier?: string;
    isActive?: boolean;
  }
) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const item = await prisma.inventoryItem.update({ where: { id }, data });
    return { success: true, item };
  } catch (error) {
    console.error('Update inventory item error:', error);
    return { success: false, error: 'Failed to update inventory item' };
  }
}

export async function addStockTransaction(data: {
  inventoryItemId: number;
  type: string; // PURCHASE | USAGE | WASTAGE | ADJUSTMENT
  quantity: number;
  unitCost?: number;
  note?: string;
  staffId?: number;
}) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const item = await prisma.inventoryItem.findUnique({ where: { id: data.inventoryItemId } });
    if (!item) return { success: false, error: 'Item not found' };

    const totalCost = (data.unitCost || item.unitCost) * Math.abs(data.quantity);

    // Create transaction
    const transaction = await prisma.inventoryTransaction.create({
      data: {
        inventoryItemId: data.inventoryItemId,
        type: data.type,
        quantity: data.quantity,
        unitCost: data.unitCost || item.unitCost,
        totalCost,
        note: data.note,
        staffId: data.staffId,
      },
    });

    // Update stock level
    const stockChange = data.type === 'PURCHASE' || data.type === 'ADJUSTMENT'
      ? Math.abs(data.quantity)
      : -Math.abs(data.quantity);

    await prisma.inventoryItem.update({
      where: { id: data.inventoryItemId },
      data: {
        currentStock: { increment: stockChange },
        ...(data.unitCost && data.type === 'PURCHASE' ? { unitCost: data.unitCost } : {}),
      },
    });

    return { success: true, transaction };
  } catch (error) {
    console.error('Add stock transaction error:', error);
    return { success: false, error: 'Failed to process stock transaction' };
  }
}

export async function getInventorySummary() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, data: null };

    const items = await prisma.inventoryItem.findMany({ where: { isActive: true } });
    const totalItems = items.length;
    const totalValue = items.reduce((sum, i) => sum + i.currentStock * i.unitCost, 0);
    const lowStock = items.filter((i) => i.currentStock <= i.reorderLevel && i.reorderLevel > 0);
    const outOfStock = items.filter((i) => i.currentStock <= 0);

    return {
      success: true,
      data: {
        totalItems,
        totalValue: roundMoney(totalValue),
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
        lowStockItems: lowStock,
      },
    };
  } catch (error) {
    console.error('Get inventory summary error:', error);
    return { success: false, error: 'Failed to fetch inventory summary', data: null };
  }
}
