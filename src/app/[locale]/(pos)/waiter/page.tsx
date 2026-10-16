'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import CategoryTabs from '@/components/pos/CategoryTabs';
import MenuGrid from '@/components/pos/MenuGrid';
import OrderPanel from '@/components/pos/OrderPanel';
import { getCategories, getMenuItems } from '@/features/menu/actions';
import { createOrder, getReadyOrders, updateOrderStatus } from '@/features/orders/actions';
import { useCartStore } from '@/features/orders/store';
import { useSocketEmit, useSocketEvent } from '@/hooks/useSocketEvent';
import { getLocaleName } from '@/lib/utils';
import Icon from '@/components/shared/Icon';
import type { OrderView } from '@/features/orders/types';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';

interface Category {
  id: number;
  nameEn: string;
  nameAm: string | null;
  icon: string | null;
  color: string | null;
}

interface MenuItem {
  id: number;
  nameEn: string;
  nameAm: string | null;
  price: number;
  isAvailable: boolean;
  image: string | null;
  category: { nameEn: string; nameAm: string | null; color: string | null };
  variants?: { id: number; nameEn: string; nameAm: string | null; priceOffset: number }[];
}

export default function WaiterPage() {
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [activeView, setActiveView] = useState<'MENU' | 'READY'>('MENU');
  const [readyOrders, setReadyOrders] = useState<OrderView[]>([]);
  const [loadingReady, setLoadingReady] = useState(false);

  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const tableNumber = useCartStore((s) => s.tableNumber);
  const orderNote = useCartStore((s) => s.orderNote);
  const discount = useCartStore((s) => s.discount);
  const clearCart = useCartStore((s) => s.clearCart);
  const emit = useSocketEmit();

  const fetchReadyOrders = async () => {
    setLoadingReady(true);
    const result = await getReadyOrders();
    if (result.success) {
      setReadyOrders(result.orders);
    }
    setLoadingReady(false);
  };

  // Load menu data
  useAsyncEffect(async () => {
    async function loadData() {
      const [catResult, itemResult] = await Promise.all([
        getCategories(),
        getMenuItems(),
      ]);
      if (catResult.success) setCategories(catResult.categories as Category[]);
      if (itemResult.success) setMenuItems(itemResult.items as MenuItem[]);
    }
    loadData();
    fetchReadyOrders();
  }, []);

  useSocketEvent('order:status-update', fetchReadyOrders);

  // Filter items by category
  const filteredItems = activeCategory
    ? menuItems.filter((item: MenuItem & { categoryId?: number }) => item.categoryId === activeCategory)
    : menuItems;

  // Waiter sends order directly to kitchen (no payment step)
  const handleSendToKitchen = async () => {
    if (items.length === 0) return;
    if (orderType === 'DINE_IN' && !tableNumber) {
      setErrorMsg('Please select a table number first.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setLoading(true);

    const result = await createOrder({
      type: orderType,
      tableNumber: tableNumber || undefined,
      note: orderNote || undefined,
      discount: discount > 0 ? discount : undefined,
      items: items.map((item) => ({
        menuItemId: item.menuItemId,
        variantId: item.variantId,
        quantity: item.quantity,
        note: item.note,
        overridePrice: item.overridePrice,
      })),
    });

    if (result.success && result.order) {
      // Emit socket event for kitchen immediately (no payment step for waiter)
      emit('order:new', { orderId: result.order.id, orderType, tableNumber });
      clearCart();
      setSuccessMsg(`Order sent to kitchen!${tableNumber ? ` Table ${tableNumber}` : ''}`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg('Failed to send order. Please try again.');
      setTimeout(() => setErrorMsg(''), 3000);
    }
    setLoading(false);
  };

  const handleMarkDelivered = async (orderId: number) => {
    const result = await updateOrderStatus(orderId, 'SERVED');
    if (result.success) {
      setSuccessMsg('Order marked as Served!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchReadyOrders();
      emit('order:status-update', { orderId, status: 'SERVED' });
    }
  };

  return (
    <>
      {/* Waiter header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--accent-gold)', color: 'white',
        padding: 'var(--space-2) var(--space-4)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        fontSize: '0.875rem', fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Icon name="menu" size={16} /> Waiter Mode
        </span>
        <span style={{ marginLeft: 'auto', opacity: 0.85, fontWeight: 400, fontSize: '0.8rem' }}>
          Orders go directly to kitchen
        </span>
      </div>

      <div className="pos-layout" style={{ paddingTop: '44px' }}>
        {/* Left Panel - Menu or Ready Orders */}
        <div className="pos-menu-panel" style={{ background: 'var(--bg-primary)' }}>
          {/* View Toggle Bar */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
            <button 
              className={`btn ${activeView === 'MENU' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveView('MENU')}
              style={{ flex: 1, borderRadius: 'var(--radius-full)' }}
            >
              <Icon name="bookOpen" size={16} /> Menu
            </button>
            <button 
              className={`btn ${activeView === 'READY' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveView('READY'); fetchReadyOrders(); }}
              style={{ flex: 1, borderRadius: 'var(--radius-full)', position: 'relative', borderColor: activeView === 'READY' ? 'var(--accent-gold)' : 'var(--success)', color: activeView === 'READY' ? 'white' : 'var(--success)' }}
            >
              <Icon name="bell" size={16} /> Ready to Serve
              {readyOrders.length > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {readyOrders.length}
                </span>
              )}
            </button>
          </div>

          {activeView === 'MENU' ? (
            <>
              {/* Category tabs */}
              <CategoryTabs
                categories={categories}
                activeId={activeCategory}
                onSelect={setActiveCategory}
              />

              {/* Menu grid */}
              <MenuGrid items={filteredItems} />
            </>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)' }}>Ready to Serve</h2>
              {loadingReady ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>Loading...</div>
              ) : readyOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>No orders waiting for pickup.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                  {readyOrders.map(order => (
                    <div key={order.id} className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', border: '2px solid var(--success)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>{order.orderNumber}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            {new Date(order.updatedAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div style={{ background: 'var(--success)', color: 'white', padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 600 }}>
                          {order.type === 'DINE_IN' ? `Table ${order.tableNumber}` : 'Takeout'}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <Icon name="user" size={14} /> Ordered by: {getLocaleName(order.staff.name, order.staff.nameAm, locale)}
                      </div>

                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <ul style={{ paddingLeft: '20px', fontSize: '0.875rem', margin: 0 }}>
                          {order.items.map((item) => (
                            <li key={item.id}>{item.quantity}x {getLocaleName(item.itemNameEn, item.itemNameAm, locale)}</li>
                          ))}
                        </ul>
                      </div>

                      <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--border)' }}>
                        <button className="btn w-full" style={{ background: 'var(--success)', color: 'white' }} onClick={() => handleMarkDelivered(order.id)}>
                          <Icon name="menu" size={16} /> Mark Served
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Order */}
        <OrderPanel
          onPlaceOrder={handleSendToKitchen}
          onPay={handleSendToKitchen}
          loading={loading}
          isWaiter={true}
        />
      </div>

      {/* Success Toast */}
      {successMsg && (
        <div className="toast-container">
          <div className="toast toast-success animate-slideInRight">
            <span style={{ color: 'var(--success)' }}><Icon name="checkCircle" size={24} /></span>
            <div>
              <div style={{ fontWeight: 600 }}>{successMsg}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {errorMsg && (
        <div className="toast-container">
          <div className="toast toast-error animate-slideInRight">
            <span style={{ color: 'var(--danger)' }}><Icon name="xCircle" size={24} /></span>
            <div>
              <div style={{ fontWeight: 600 }}>{errorMsg}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
