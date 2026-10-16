'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import CategoryTabs from '@/components/pos/CategoryTabs';
import MenuGrid from '@/components/pos/MenuGrid';
import OrderPanel from '@/components/pos/OrderPanel';
import PaymentModal from '@/features/payments/components/PaymentModal';
import { getCategories, getMenuItems } from '@/features/menu/actions';
import { createOrder, getUnpaidOrders, getReadyOrders, updateOrderStatus } from '@/features/orders/actions';
import type { OrderView } from '@/features/orders/types';
import { useCartStore } from '@/features/orders/store';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import { useSocketEmit, useSocketEvent } from '@/hooks/useSocketEvent';
import { formatPrice, getLocaleName } from '@/lib/utils';
import Icon from '@/components/shared/Icon';

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

export default function CashierPage() {
  const t = useTranslations('pos');
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  
  const [activeView, setActiveView] = useState<'MENU' | 'ORDERS' | 'READY'>('MENU');
  const [unpaidOrders, setUnpaidOrders] = useState<OrderView[]>([]);
  const [readyOrders, setReadyOrders] = useState<OrderView[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [paymentTotal, setPaymentTotal] = useState<number>(0);
  const [successMsg, setSuccessMsg] = useState('');

  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const tableNumber = useCartStore((s) => s.tableNumber);
  const orderNote = useCartStore((s) => s.orderNote);
  const discount = useCartStore((s) => s.discount);
  const getTotal = useCartStore((s) => s.getTotal);
  const clearCart = useCartStore((s) => s.clearCart);
  const emit = useSocketEmit();

  const fetchUnpaidOrders = async () => {
    setLoadingOrders(true);
    const result = await getUnpaidOrders();
    if (result.success) setUnpaidOrders(result.orders);
    setLoadingOrders(false);
  };

  const fetchReadyOrders = async () => {
    const result = await getReadyOrders();
    if (result.success) setReadyOrders(result.orders);
  };

  // Load menu data
  useAsyncEffect(() => {
    async function loadData() {
      const [catResult, itemResult] = await Promise.all([
        getCategories(),
        getMenuItems(),
      ]);
      if (catResult.success) setCategories(catResult.categories as Category[]);
      if (itemResult.success) setMenuItems(itemResult.items as MenuItem[]);
    }
    loadData();
    fetchUnpaidOrders();
    fetchReadyOrders();
  }, []);

  // Listen for new orders to refresh lists automatically
  useSocketEvent('order:new', fetchUnpaidOrders);
  useSocketEvent('order:status-update', () => {
    fetchUnpaidOrders();
    fetchReadyOrders();
  });

  // Filter items by category
  const filteredItems = activeCategory
    ? menuItems.filter((item: MenuItem & { categoryId?: number }) => item.categoryId === activeCategory)
    : menuItems;

  const handlePayNewOrder = async () => {
    if (items.length === 0) return;
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
      setCurrentOrderId(result.order.id);
      setPaymentTotal(getTotal());
      setShowPayment(true);
    }
    setLoading(false);
  };

  const handlePayExistingOrder = (order: OrderView) => {
    const total = order.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    setCurrentOrderId(order.id);
    setPaymentTotal(total);
    setShowPayment(true);
  };

  const handlePaymentComplete = () => {
    setShowPayment(false);
    emit('order:new', { orderId: currentOrderId, orderType, tableNumber });
    clearCart();
    setCurrentOrderId(null);
    setPaymentTotal(0);

    fetchUnpaidOrders();

    const isNewOrder = paymentTotal === getTotal() && items.length > 0;
    setSuccessMsg(isNewOrder ? t('orderPlaced') : 'Payment Confirmed & Accepted');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <>
      <div className="pos-layout">
        {/* Left Panel - Menu / Orders Toggle */}
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
              className={`btn ${activeView === 'ORDERS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveView('ORDERS'); fetchUnpaidOrders(); }}
              style={{ flex: 1, borderRadius: 'var(--radius-full)', position: 'relative' }}
            >
              <Icon name="coins" size={16} /> Unpaid
              {unpaidOrders.length > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {unpaidOrders.length}
                </span>
              )}
            </button>
            <button 
              className={`btn ${activeView === 'READY' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveView('READY'); fetchReadyOrders(); }}
              style={{ flex: 1, borderRadius: 'var(--radius-full)', position: 'relative', borderColor: activeView === 'READY' ? 'var(--accent-gold)' : 'var(--success)', color: activeView === 'READY' ? 'white' : 'var(--success)' }}
            >
              <Icon name="bell" size={16} /> Ready
              {readyOrders.length > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {readyOrders.length}
                </span>
              )}
            </button>
          </div>

          {activeView === 'MENU' && (
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
          )}

          {activeView === 'ORDERS' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)' }}>Unpaid Orders</h2>
              {loadingOrders ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>Loading...</div>
              ) : unpaidOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>No unpaid orders.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                  {unpaidOrders.map(order => {
                    const total = order.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
                    return (
                      <div key={order.id} className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>{order.orderNumber}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                              {new Date(order.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                          <div style={{ background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600 }}>
                            {order.type === 'DINE_IN' ? `Table ${order.tableNumber}` : 'Takeout'}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          <Icon name="user" size={14} /> {getLocaleName(order.staff.name, order.staff.nameAm, locale)} ({order.staff.role})
                        </div>

                        {/* Order Item Details */}
                        <div style={{ marginTop: 'var(--space-2)' }}>
                          <ul style={{ paddingLeft: '20px', fontSize: '0.875rem', margin: 0 }}>
                            {order.items.map((item) => (
                              <li key={item.id}>{item.quantity}x {getLocaleName(item.itemNameEn, item.itemNameAm, locale)}</li>
                            ))}
                          </ul>
                        </div>

                        <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1.125rem', color: 'var(--accent-gold)' }}>
                            {formatPrice(total, locale)}
                          </span>
                          <button className="btn btn-primary btn-sm" onClick={() => handlePayExistingOrder(order)}>
                            Pay Now
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeView === 'READY' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)' }}>Ready to Serve</h2>
              {readyOrders.length === 0 ? (
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
                        <button className="btn w-full" style={{ background: 'var(--success)', color: 'white' }} onClick={async () => {
                          const result = await updateOrderStatus(order.id, 'SERVED');
                          if (result.success) {
                            fetchReadyOrders();
                            emit('order:status-update', { orderId: order.id, status: 'SERVED' });
                          }
                        }}>
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
          onPlaceOrder={handlePayNewOrder}
          onPay={handlePayNewOrder}
          loading={loading}
        />
      </div>

      {/* Payment Modal */}
      {showPayment && currentOrderId && (
        <PaymentModal
          orderId={currentOrderId}
          total={paymentTotal}
          onComplete={handlePaymentComplete}
          onClose={() => setShowPayment(false)}
        />
      )}

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
    </>
  );
}
