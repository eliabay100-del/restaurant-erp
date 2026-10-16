'use server';

import { prisma } from '@/lib/prisma';
import { authorize, ALL_ROLES, MANAGEMENT_ROLES } from '@/lib/auth';
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
