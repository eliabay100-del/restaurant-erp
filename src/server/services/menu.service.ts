import { prisma } from '@/lib/prisma';
import { getEffectivePrice, getScheduledIncrease } from '@/lib/scheduled-pricing';
import { resolveMenuImage } from '@/lib/menu-art';
import type {
  MenuCategoryView,
  MenuItemView,
  PublicMenuData,
  StudioCategory,
  StudioItem,
} from '@/features/menu/menu-types';

/**
 * Narrow menu queries shared by the POS and menu-management screens.
 *
 * The old actions used `include: { category: true, variants: true }`, which
 * pulled every column of every relation. These selects keep only the fields
 * the UI renders, which makes the payload and SQLite work much smaller.
 */

const scheduledPriceSelect = {
  scheduledIncrease: true,
  scheduledIncreaseStart: true,
  scheduledIncreaseEnd: true,
  scheduledIncreaseEnabled: true,
} as const;

export function fetchPosCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, nameEn: true, nameAm: true, icon: true, color: true },
  });
}

export async function fetchPosMenuItems(categoryId?: number) {
  const items = await prisma.menuItem.findMany({
    where: { isAvailable: true, ...(categoryId ? { categoryId } : {}) },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
    select: {
      id: true,
      nameEn: true,
      nameAm: true,
      price: true,
      isAvailable: true,
      image: true,
      categoryId: true,
      kind: true,
      ...scheduledPriceSelect,
      category: { select: { nameEn: true, nameAm: true, color: true, isActive: true } },
      variants: {
        where: { isActive: true },
        select: { id: true, nameEn: true, nameAm: true, priceOffset: true, ...scheduledPriceSelect },
      },
    },
  });

  // The POS and delivery screens render the price they are given. Bake the
  // active increase into the item price and the variant offset so the cart
  // total matches what the server later charges.
  const now = new Date();
  return items.map((item) => {
    const itemIncrease = getScheduledIncrease(item, now, item.kind);
    return {
      ...item,
      price: item.price + itemIncrease,
      scheduledIncreaseActive: itemIncrease > 0,
      variants: item.variants.map((variant) => {
        const variantIncrease = getScheduledIncrease(variant, now, item.kind);
        return {
          ...variant,
          priceOffset: variant.priceOffset + variantIncrease,
          scheduledIncreaseActive: variantIncrease > 0,
        };
      }),
    };
  });
}

export function fetchManagementCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, nameEn: true, nameAm: true, color: true, icon: true },
  });
}

/** Every category, including inactive ones, for the owner's Menu Studio. */
export function fetchStudioCategories(): Promise<StudioCategory[]> {
  return prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      nameEn: true,
      nameAm: true,
      color: true,
      icon: true,
      sortOrder: true,
      isActive: true,
    },
  });
}

export function fetchManagementMenuItems(): Promise<StudioItem[]> {
  return prisma.menuItem.findMany({
    // Archived rows exist only so historical orders keep their FK; they are
    // not part of the current menu and should not clutter management.
    where: { category: { nameEn: { not: 'Archived Menu' } } },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
    select: {
      id: true,
      nameEn: true,
      nameAm: true,
      descEn: true,
      descAm: true,
      price: true,
      isAvailable: true,
      categoryId: true,
      image: true,
      kind: true,
      sortOrder: true,
      ...scheduledPriceSelect,
      category: {
        select: {
          id: true,
          nameEn: true,
          nameAm: true,
          color: true,
          icon: true,
          isActive: true,
        },
      },
      variants: {
        select: {
          id: true,
          menuItemId: true,
          nameEn: true,
          nameAm: true,
          priceOffset: true,
          isActive: true,
          ...scheduledPriceSelect,
        },
      },
    },
  });
}

export function fetchPublicCategories(): Promise<MenuCategoryView[]> {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      nameEn: true,
      nameAm: true,
      color: true,
      icon: true,
      sortOrder: true,
    },
  });
}

export async function fetchPublicMenuItems(categoryId?: number): Promise<MenuItemView[]> {
  const items = await prisma.menuItem.findMany({
    where: { isAvailable: true, kind: 'PRODUCT', ...(categoryId ? { categoryId } : {}) },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
    select: {
      id: true,
      nameEn: true,
      nameAm: true,
      descEn: true,
      descAm: true,
      price: true,
      isAvailable: true,
      categoryId: true,
      image: true,
      sortOrder: true,
      ...scheduledPriceSelect,
      category: {
        select: {
          id: true,
          nameEn: true,
          nameAm: true,
          color: true,
          icon: true,
        },
      },
      variants: {
        where: { isActive: true },
        select: {
          id: true,
          nameEn: true,
          nameAm: true,
          priceOffset: true,
          ...scheduledPriceSelect,
        },
      },
    },
  });

  const now = new Date();
  return items.map((item) => {
    const itemIncrease = getScheduledIncrease(item, now, 'PRODUCT');
    const effectivePrice = getEffectivePrice(item.price, item, now, 'PRODUCT');

    return {
      id: item.id,
      nameEn: item.nameEn,
      nameAm: item.nameAm,
      descEn: item.descEn,
      descAm: item.descAm,
      price: effectivePrice,
      basePrice: item.price,
      image: resolveMenuImage(item.image, item.nameEn),
      isAvailable: item.isAvailable,
      categoryId: item.categoryId,
      sortOrder: item.sortOrder,
      category: item.category,
      scheduledIncreaseActive: itemIncrease > 0,
      variants: item.variants.map((variant) => {
        const variantIncrease = getScheduledIncrease(variant, now, 'PRODUCT');
        const effectiveOffset = variant.priceOffset + variantIncrease;
        return {
          id: variant.id,
          nameEn: variant.nameEn,
          nameAm: variant.nameAm,
          priceOffset: effectiveOffset,
          price: effectivePrice + effectiveOffset,
          scheduledIncreaseActive: variantIncrease > 0,
        };
      }),
    };
  });
}

/** One read for the public table menu. */
export async function fetchPublicMenuData(): Promise<PublicMenuData> {
  const [categories, items] = await Promise.all([
    fetchPublicCategories(),
    fetchPublicMenuItems(),
  ]);
  return { categories, items };
}
