import { create } from 'zustand';
import { computeOrderTotals, roundMoney, TAX_RATE } from '@/lib/money';

export { TAX_RATE };

export interface CartItem {
  menuItemId: number;
  variantId?: number;
  nameEn: string;
  nameAm: string | null;
  variantNameEn?: string;
  variantNameAm?: string | null;
  price: number;
  overridePrice?: number;
  quantity: number;
  note?: string;
}

interface CartStore {
  items: CartItem[];
  orderType: 'DINE_IN' | 'TAKEOUT';
  tableNumber: string | null;
  orderNote: string;
  discount: number;

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (menuItemId: number, variantId?: number) => void;
  updateQuantity: (menuItemId: number, variantId: number | undefined, quantity: number) => void;
  updateItemNote: (menuItemId: number, variantId: number | undefined, note: string) => void;
  clearCart: () => void;
  setOrderType: (type: 'DINE_IN' | 'TAKEOUT') => void;
  setTableNumber: (table: string | null) => void;
  setOrderNote: (note: string) => void;
  setDiscount: (discount: number) => void;

  // Computed
  getSubtotal: () => number;
  getDiscount: () => number;
  getTax: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

const cartMoneyItems = (items: CartItem[]) => items.map((i) => ({ unitPrice: i.price, quantity: i.quantity }));

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  orderType: 'DINE_IN',
  tableNumber: null,
  orderNote: '',
  discount: 0,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find(
        (i) => i.menuItemId === item.menuItemId && i.variantId === item.variantId
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.menuItemId === item.menuItemId && i.variantId === item.variantId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return { items: [...state.items, { ...item, quantity: 1 }] };
    }),

  removeItem: (menuItemId, variantId) =>
    set((state) => ({
      items: state.items.filter(
        (i) => !(i.menuItemId === menuItemId && i.variantId === variantId)
      ),
    })),

  updateQuantity: (menuItemId, variantId, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter(
              (i) => !(i.menuItemId === menuItemId && i.variantId === variantId)
            )
          : state.items.map((i) =>
              i.menuItemId === menuItemId && i.variantId === variantId
                ? { ...i, quantity }
                : i
            ),
    })),

  updateItemNote: (menuItemId, variantId, note) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItemId === menuItemId && i.variantId === variantId
          ? { ...i, note }
          : i
      ),
    })),

  clearCart: () =>
    set({ items: [], tableNumber: null, orderNote: '', discount: 0 }),

  setOrderType: (orderType) => set({ orderType }),
  setTableNumber: (tableNumber) => set({ tableNumber }),
  setOrderNote: (orderNote) => set({ orderNote }),
  setDiscount: (discount) =>
    set({ discount: Math.max(roundMoney(discount), 0) }),

  getSubtotal: () => {
    const { items } = get();
    return roundMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  },

  getDiscount: () => {
    return Math.min(Math.max(roundMoney(get().discount), 0), get().getSubtotal());
  },

  getTax: () => {
    return computeOrderTotals(cartMoneyItems(get().items), get().discount).taxAmount;
  },

  getTotal: () => {
    return computeOrderTotals(cartMoneyItems(get().items), get().discount).total;
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
