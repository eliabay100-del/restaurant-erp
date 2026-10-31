'use server';

import { prisma } from '@/lib/prisma';
import { authorize, ALL_ROLES, MANAGEMENT_ROLES } from '@/lib/auth';
import { parseMoney } from '@/lib/money';
import { fetchStudioCategories, fetchManagementMenuItems } from '@/server/services/menu.service';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'menu');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function getCategories() {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, categories: [] };

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { items: true } },
      },
    });
    return { success: true, categories };
  } catch (error) {
    console.error('Get categories error:', error);
    return { success: false, error: 'Failed to fetch categories', categories: [] };
  }
}

export async function getMenuItems(categoryId?: number) {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, items: [] };

    const where = categoryId
      ? { categoryId, isAvailable: true }
      : { isAvailable: true };

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { category: true, variants: { where: { isActive: true } } },
    });

    return { success: true, items };
  } catch (error) {
    console.error('Get menu items error:', error);
    return { success: false, error: 'Failed to fetch menu items', items: [] };
  }
}

export async function getAllMenuItems() {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, items: [] };

    const items = await prisma.menuItem.findMany({
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
      include: { category: true, variants: true },
    });
    return { success: true, items };
  } catch (error) {
    console.error('Get all menu items error:', error);
    return { success: false, error: 'Failed to fetch menu items', items: [] };
  }
}

export async function createMenuItem(data: {
  nameEn: string;
  nameAm?: string;
  descEn?: string;
  descAm?: string;
  price: number;
  categoryId: number;
  image?: string;
  sortOrder?: number;
}) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (!data.nameEn?.trim()) return { success: false, error: 'Item name is required' };
    if (!Number.isFinite(data.price) || data.price < 0) {
      return { success: false, error: 'Price must be a positive number' };
    }

    const item = await prisma.menuItem.create({ data });
    return { success: true, item };
  } catch (error) {
    console.error('Create menu item error:', error);
    return { success: false, error: 'Failed to create menu item' };
  }
}

export async function updateMenuItem(
  id: number,
  data: {
    nameEn?: string;
    nameAm?: string;
    descEn?: string;
    descAm?: string;
    price?: number;
    categoryId?: number;
    image?: string | null;
    isAvailable?: boolean;
    sortOrder?: number;
  }
) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (data.price !== undefined && (!Number.isFinite(data.price) || data.price < 0)) {
      return { success: false, error: 'Price must be a positive number' };
    }

    const item = await prisma.menuItem.update({ where: { id }, data });
    return { success: true, item };
  } catch (error) {
    console.error('Update menu item error:', error);
    return { success: false, error: 'Failed to update menu item' };
  }
}

export async function uploadMenuImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: 'No image provided' };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { success: false, error: 'Image must be 5 MB or smaller' };
    }

    const ext = IMAGE_EXT[file.type];
    if (!ext) {
      return { success: false, error: 'Only JPG, PNG, WEBP or GIF images are allowed' };
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, filename), bytes);

    return { success: true, url: `/uploads/menu/${filename}` };
  } catch (error) {
    console.error('Upload menu image error:', error);
    return { success: false, error: 'Failed to upload image' };
  }
}

// ============ PORTIONS / VARIANTS ============

export async function createMenuVariant(data: {
  menuItemId: number;
  nameEn: string;
  nameAm?: string;
  priceOffset?: number;
}) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (!data.nameEn?.trim()) return { success: false, error: 'Portion name is required' };

    const variant = await prisma.menuVariant.create({
      data: {
        menuItemId: data.menuItemId,
        nameEn: data.nameEn.trim(),
        nameAm: data.nameAm?.trim() || null,
        priceOffset: Number.isFinite(data.priceOffset) ? Number(data.priceOffset) : 0,
      },
    });
    return { success: true, variant };
  } catch (error) {
    console.error('Create menu variant error:', error);
    return { success: false, error: 'Failed to create portion' };
  }
}

export async function updateMenuVariant(
  id: number,
  data: { nameEn?: string; nameAm?: string; priceOffset?: number; isActive?: boolean }
) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const variant = await prisma.menuVariant.update({ where: { id }, data });
    return { success: true, variant };
  } catch (error) {
    console.error('Update menu variant error:', error);
    return { success: false, error: 'Failed to update portion' };
  }
}

export async function deleteMenuVariant(id: number) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    await prisma.menuVariant.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    console.error('Delete menu variant error:', error);
    return { success: false, error: 'Failed to delete portion' };
  }
}

export async function toggleItemAvailability(id: number) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) return { success: false, error: 'Item not found' };

    const updated = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !item.isAvailable },
    });
    return { success: true, item: updated };
  } catch (error) {
    console.error('Toggle availability error:', error);
    return { success: false, error: 'Failed to toggle availability' };
  }
}

export async function deleteMenuItem(id: number) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    await prisma.menuItem.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    console.error('Delete menu item error:', error);
    return { success: false, error: 'Failed to delete menu item' };
  }
}

export async function createCategory(data: {
  nameEn: string;
  nameAm?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const category = await prisma.category.create({ data });
    return { success: true, category };
  } catch (error) {
    console.error('Create category error:', error);
    return { success: false, error: 'Failed to create category' };
  }
}

export async function updateCategory(
  id: number,
  data: {
    nameEn?: string;
    nameAm?: string;
    color?: string;
    icon?: string;
    isActive?: boolean;
    sortOrder?: number;
  }
) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const category = await prisma.category.update({ where: { id }, data });
    return { success: true, category };
  } catch (error) {
    console.error('Update category error:', error);
    return { success: false, error: 'Failed to update category' };
  }
}


export async function getStudioMenuData() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, categories: [], items: [] };

    const [categories, items] = await Promise.all([
      fetchStudioCategories(),
      fetchManagementMenuItems(),
    ]);
    return { success: true, categories, items };
  } catch (error) {
    console.error('Get studio menu data error:', error);
    return { success: false, error: 'Failed to fetch studio data', categories: [], items: [] };
  }
}


export interface ScheduledPriceUpdate {
  targetType: 'item' | 'variant';
  id: number;
  /** Fixed increase in ETB, converted to santim on the server. */
  amountEtb: number;
  startMinute: number;
  endMinute: number;
  enabled: boolean;
}

/**
 * Save per-item / per-size daily price increases.
 *
 * Each target has its own amount and window. Existing orders keep their price
 * snapshots; only future menu reads and order creation use the new values.
 */
export async function updateScheduledPriceIncreases(updates: ScheduledPriceUpdate[]) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (!Array.isArray(updates) || updates.length === 0) {
      return { success: false, error: 'No price changes to save' };
    }

    const itemIds: number[] = [];
    const variantIds: number[] = [];
    const normalized = updates.map((update) => {
      const id = Number(update.id);
      const startMinute = Number(update.startMinute);
      const endMinute = Number(update.endMinute);
      const amount = parseMoney(update.amountEtb);

      if (update.targetType !== 'item' && update.targetType !== 'variant') {
        throw new Error('Invalid price target');
      }
      if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid price target');
      if (!Number.isInteger(startMinute) || startMinute < 0 || startMinute > 1439) {
        throw new Error('Invalid start time');
      }
      if (!Number.isInteger(endMinute) || endMinute < 0 || endMinute > 1439) {
        throw new Error('Invalid end time');
      }
      if (startMinute === endMinute) throw new Error('Start and end times must be different');
      if (amount === null || amount < 0) throw new Error('Increase must be zero or more');

      if (update.targetType === 'item') itemIds.push(id);
      else variantIds.push(id);

      return {
        targetType: update.targetType,
        id,
        scheduledIncrease: amount,
        scheduledIncreaseStart: startMinute,
        scheduledIncreaseEnd: endMinute,
        scheduledIncreaseEnabled: Boolean(update.enabled),
      };
    });

    const uniqueItemIds = [...new Set(itemIds)];
    const uniqueVariantIds = [...new Set(variantIds)];

    const [items, variants] = await Promise.all([
      uniqueItemIds.length > 0
        ? prisma.menuItem.findMany({
            where: { id: { in: uniqueItemIds } },
            select: { id: true, kind: true },
          })
        : Promise.resolve([]),
      uniqueVariantIds.length > 0
        ? prisma.menuVariant.findMany({
            where: { id: { in: uniqueVariantIds } },
            select: { id: true, menuItem: { select: { kind: true } } },
          })
        : Promise.resolve([]),
    ]);

    if (items.length !== uniqueItemIds.length || variants.length !== uniqueVariantIds.length) {
      return { success: false, error: 'One or more menu items no longer exist' };
    }
    if (items.some((item) => item.kind !== 'PRODUCT') || variants.some((variant) => variant.menuItem.kind !== 'PRODUCT')) {
      return { success: false, error: 'Fee items cannot have a scheduled increase' };
    }

    await prisma.$transaction(
      normalized.map((update) =>
        update.targetType === 'item'
          ? prisma.menuItem.update({
              where: { id: update.id },
              data: {
                scheduledIncrease: update.scheduledIncrease,
                scheduledIncreaseStart: update.scheduledIncreaseStart,
                scheduledIncreaseEnd: update.scheduledIncreaseEnd,
                scheduledIncreaseEnabled: update.scheduledIncreaseEnabled,
              },
            })
          : prisma.menuVariant.update({
              where: { id: update.id },
              data: {
                scheduledIncrease: update.scheduledIncrease,
                scheduledIncreaseStart: update.scheduledIncreaseStart,
                scheduledIncreaseEnd: update.scheduledIncreaseEnd,
                scheduledIncreaseEnabled: update.scheduledIncreaseEnabled,
              },
            }),
      ),
    );

    return { success: true, updated: normalized.length };
  } catch (error) {    console.error('Update scheduled price increases error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save price changes' };
  }
}
