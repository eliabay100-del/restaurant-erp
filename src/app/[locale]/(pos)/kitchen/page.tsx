'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getActiveOrders, updateOrderStatus, updateOrderItemStatus } from '@/features/orders/actions';
import { useSocketEvent, useSocketEmit } from '@/hooks/useSocketEvent';
import { getLocaleName, getMinutesElapsed } from '@/lib/utils';
import Icon from '@/components/shared/Icon';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';

interface OrderItem {
  id: number;
  itemNameEn: string;
  itemNameAm: string | null;
  quantity: number;
  status: string;
  note: string | null;
}

interface Order {
  id: number;
  orderNumber: string;
  type: string;
  status: string;
  tableNumber: string | null;
  note: string | null;
  createdAt: string;
  items: OrderItem[];
  staff: { name: string; nameAm: string | null };
}

export default function KitchenPage() {
  const t = useTranslations('kitchen');
  const locale = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const emit = useSocketEmit();
  const [, setTick] = useState(0);

  // Tick every 30s to update elapsed times
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Load initial orders
  const loadOrders = useCallback(async () => {
    const result = await getActiveOrders();
    if (result.success && result.orders) {
      setOrders(result.orders as Order[]);
    }
  }, []);

  useAsyncEffect(loadOrders, [loadOrders]);
  useEffect(() => {
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Real-time: new order (beep + reload)
  const handleNewOrder = useCallback(() => {
    loadOrders();
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* ignore audio errors */ }
  }, [loadOrders]);

  useSocketEvent('order:new', handleNewOrder);
  useSocketEvent('order:status-update', loadOrders);

  // Mark a single item as READY or PREPARING
  const handleItemToggle = async (orderId: number, itemId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'READY' ? 'PREPARING' : 'READY';
    setUpdatingItemId(itemId);
    const result = await updateOrderItemStatus(itemId, nextStatus);
    if (result.success) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                items: o.items.map((i) => (i.id === itemId ? { ...i, status: nextStatus } : i)),
                // Auto-update order status based on items
                status: o.items.every((i) => (i.id === itemId ? nextStatus : i.status) === 'READY')
                  ? 'READY'
                  : o.items.some((i) => (i.id === itemId ? nextStatus : i.status) !== 'PENDING')
                  ? 'PREPARING'
                  : 'PENDING',
              }
            : o
        )
      );
      emit('order:status-update', { orderId });
    }
    setUpdatingItemId(null);
  };

  // Mark entire order as READY (removes it from KDS, sends to Waiter/Cashier)
  const handleServeOrder = async (orderId: number) => {
    setUpdatingOrderId(orderId);
    const result = await updateOrderStatus(orderId, 'READY');
    if (result.success) {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      emit('order:status-update', { orderId, status: 'READY' });
    }
    setUpdatingOrderId(null);
  };

  // Mark entire order as PREPARING (bulk start)
  const handleStartOrder = async (orderId: number) => {
    setUpdatingOrderId(orderId);
    const result = await updateOrderStatus(orderId, 'PREPARING');
    if (result.success) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: 'PREPARING', items: o.items.map((i) => ({ ...i, status: 'PREPARING' })) }
            : o
        )
      );
      emit('order:status-update', { orderId, status: 'PREPARING' });
    }
    setUpdatingOrderId(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'status-pending';
      case 'PREPARING': return 'status-preparing';
      case 'READY': return 'status-ready';
      default: return '';
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const preparingCount = orders.filter((o) => o.status === 'PREPARING').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - var(--footer-height))' }}>
      {/* KDS Header */}
      <div style={{
        padding: 'var(--space-3) var(--space-5)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <h1 style={{ fontSize: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Icon name="kitchen" size={22} /> {t('kitchenDisplay')}</h1>
          {pendingCount > 0 && (
            <span className="badge badge-pending" style={{ fontSize: '0.875rem', padding: 'var(--space-1) var(--space-3)' }}>
              {pendingCount} {t('newTag')}
            </span>
          )}
          {preparingCount > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.875rem', padding: 'var(--space-1) var(--space-3)', background: 'var(--warning)', color: 'white' }}>
              {preparingCount} {t('cooking')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>{orders.length} {t('active')}</span>
        </div>
      </div>

      {/* Orders Grid */}
      {orders.length === 0 ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-state-icon"><Icon name="kitchen" size={48} /></div>
          <div className="empty-state-title">{t('noOrders')}</div>
          <div className="empty-state-desc">{t('noOrdersDesc')}</div>
        </div>
      ) : (
        <div className="kds-layout">
          {orders.map((order) => {
            const mins = getMinutesElapsed(order.createdAt);
            const isUrgent = mins >= 15 && order.status !== 'READY';
            const allReady = order.items.length > 0 && order.items.every((i) => i.status === 'READY');
            const isLoading = updatingOrderId === order.id;

            return (
              <div key={order.id} className={`kds-ticket ${getStatusColor(order.status)} ${isUrgent ? 'urgent' : ''}`}>
                {/* Ticket Header */}
                <div className="kds-ticket-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="kds-order-number">#{order.orderNumber.split('-').pop()}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {order.type === 'DINE_IN' && order.tableNumber ? (<><Icon name="menu" size={14} /> T{order.tableNumber}</>) : (<><Icon name="inventory" size={14} /> {t('takeout')}</>)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.75rem' }}>
                    {isUrgent && <span className="badge badge-danger">{t('urgent')}</span>}
                    <span className="kds-order-time">
                      {mins < 1 ? t('justNow') : `${mins}m`}
                    </span>
                  </div>
                </div>

                {/* Waiter name */}
                <div style={{ padding: '0 var(--space-3) var(--space-1)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="user" size={13} /> {getLocaleName(order.staff.name, order.staff.nameAm, locale)}
                </div>

                {/* Item-level checklist */}
                <div className="kds-ticket-body">
                  {order.items.map((item) => {
                    const isItemReady = item.status === 'READY';
                    const isUpdating = updatingItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="kds-item"
                        style={{
                          opacity: isItemReady ? 0.55 : 1,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-2)',
                          borderRadius: 'var(--radius-xs)',
                          background: isItemReady ? 'var(--success-glow)' : 'transparent',
                          transition: 'all 0.2s ease',
                          marginBottom: 'var(--space-1)',
                        }}
                        onClick={() => !isUpdating && handleItemToggle(order.id, item.id, item.status)}
                      >
                        {/* Checkbox */}
                        <span style={{
                          width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${isItemReady ? 'var(--success)' : 'var(--border)'}`,
                          background: isItemReady ? 'var(--success)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', color: 'white',
                          transition: 'all 0.2s',
                        }}>
                          {isUpdating ? <Icon name="loader" size={14} /> : isItemReady ? <Icon name="check" size={14} /> : ''}
                        </span>

                        <div style={{ flex: 1 }}>
                          <span className="kds-item-name" style={{ textDecoration: isItemReady ? 'line-through' : 'none' }}>
                            {getLocaleName(item.itemNameEn, item.itemNameAm, locale)}
                          </span>
                          {item.note && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--accent-gold)', marginTop: '2px' }}>
                              <Icon name="note" size={12} /> {item.note}
                            </div>
                          )}
                        </div>
                        <span className="kds-item-qty">×{item.quantity}</span>
                      </div>
                    );
                  })}

                  {order.note && (
                    <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--warning-glow)', borderRadius: 'var(--radius-xs)', fontSize: '0.8125rem', color: 'var(--accent-gold)' }}>
                      <Icon name="note" size={14} /> {order.note}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="kds-ticket-footer" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {order.status === 'PENDING' && (
                    <button
                      className="btn btn-lg w-full"
                      style={{ background: 'var(--warning)', color: 'white' }}
                      disabled={isLoading}
                      onClick={() => handleStartOrder(order.id)}
                    >
                      <Icon name="flame" size={18} /> {t('markPreparing')}
                    </button>
                  )}

                  {order.status === 'PREPARING' && (
                    <button
                      className="btn btn-lg w-full"
                      style={{ background: allReady ? 'var(--success)' : 'var(--bg-input)', color: allReady ? 'white' : 'var(--text-muted)' }}
                      disabled={isLoading || !allReady}
                      onClick={() => handleServeOrder(order.id)}
                    >
                      {allReady ? (<><Icon name="bell" size={18} /> {t('markReady')}</>) : (<><Icon name="hourglass" size={18} /> {order.items.filter((i) => i.status === 'READY').length}/{order.items.length} {t('ready')}</>)}
                    </button>
                  )}

                  {order.status === 'READY' && (
                    <button
                      className="btn btn-lg w-full"
                      style={{ background: 'var(--success)', color: 'white' }}
                      disabled={isLoading}
                      onClick={() => handleServeOrder(order.id)}
                    >
                      <Icon name="bell" size={18} /> {t('markReady')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
