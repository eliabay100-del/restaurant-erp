export interface MenuCategoryView {
  id: number;
  nameEn: string;
  nameAm: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
}

export interface MenuItemView {
  id: number;
  nameEn: string;
  nameAm: string | null;
  descEn: string | null;
  descAm: string | null;
  price: number;
  basePrice: number;
  isAvailable: boolean;
  categoryId: number;
  image: string | null;
  sortOrder: number;
  category: { nameEn: string; nameAm: string | null; color: string | null; icon: string | null };
  scheduledIncreaseActive: boolean;
  variants: {
    id: number;
    nameEn: string;
    nameAm: string | null;
    priceOffset: number;
    price: number;
    scheduledIncreaseActive: boolean;
  }[];
}

export interface PublicMenuData {
  categories: MenuCategoryView[];
  items: MenuItemView[];
}

export interface StudioCategory {
  id: number;
  nameEn: string;
  nameAm: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export type StudioTab = 'items' | 'categories' | 'prices';

export interface StudioVariant {
  id: number;
  menuItemId: number;
  nameEn: string;
  nameAm: string | null;
  priceOffset: number;
  isActive: boolean;
  scheduledIncrease: number;
  scheduledIncreaseStart: number;
  scheduledIncreaseEnd: number;
  scheduledIncreaseEnabled: boolean;
}

export interface StudioItem {
  id: number;
  nameEn: string;
  nameAm: string | null;
  descEn: string | null;
  descAm: string | null;
  price: number;
  isAvailable: boolean;
  categoryId: number;
  image: string | null;
  kind: string;
  sortOrder: number;
  scheduledIncrease: number;
  scheduledIncreaseStart: number;
  scheduledIncreaseEnd: number;
  scheduledIncreaseEnabled: boolean;
  category: {
    id: number;
    nameEn: string;
    nameAm: string | null;
    color: string | null;
    icon: string | null;
    isActive: boolean;
  };
  variants: StudioVariant[];
}
