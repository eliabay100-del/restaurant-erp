'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCartStore } from '@/features/orders/store';
import { getLocaleName, formatPrice } from '@/lib/utils';
import Icon from '@/components/shared/Icon';

interface OrderPanelProps {
  onPlaceOrder: () => void;
  onPay: () => void;
  loading?: boolean;
  isWaiter?: boolean;
}

export default function OrderPanel({ onPlaceOrder, onPay, loading, isWaiter }: OrderPanelProps) {
  const t = useTranslations('pos');
  const tc = useTranslations('common');
  const locale = useLocale();

  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const tableNumber = useCartStore((s) => s.tableNumber);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const setTableNumber = useCartStore((s) => s.setTableNumber);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getDiscount = useCartStore((s) => s.getDiscount);
  const discount = useCartStore((s) => s.discount);
  const setDiscount = useCartStore((s) => s.setDiscount);
  const getTax = useCartStore((s) => s.getTax);
  const getTotal = useCartStore((s) => s.getTotal);

  const handleDiscount = () => {
    const input = window.prompt(
      'Enter discount amount (ETB):',
      discount > 0 ? String(discount) : '0',
    );
    if (input === null) return;
    const value = parseFloat(input);
    setDiscount(Number.isNaN(value) ? 0 : value);
  };

  const tables = Array.from({ length: 20 }, (_, i) => String(i + 1));

  return (
    <div className="pos-order-panel">
      {/* Order Type Toggle */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '3px' }}>
          <button
            className={`btn btn-sm ${orderType === 'DINE_IN' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setOrderType('DINE_IN')}
            style={{ flex: 1 }}
          >
            <Icon name="menu" size={16} /> {t('dineIn')}
          </button>
          <button
            className={`btn btn-sm ${orderType === 'TAKEOUT' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setOrderType('TAKEOUT')}
            style={{ flex: 1 }}
          >
            <Icon name="inventory" size={16} /> {t('takeout')}
          </button>
        </div>

        {/* Takeout Packaging Fee Option */}
        {orderType === 'TAKEOUT' && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <button 
              className="btn btn-secondary btn-sm w-full"
              style={{ fontSize: '0.8125rem', minHeight: '32px' }}
              onClick={() => {
                const feeStr = window.prompt('Enter custom packaging fee amount (ETB):', '15');
                const fee = feeStr ? parseFloat(feeStr) : Number.NaN;
                if (!Number.isNaN(fee) && fee >= 0) {
                  // Using the Takeaway Packaging item we added (ID 55)
                  useCartStore.getState().addItem({
                    menuItemId: 55,
                    nameEn: 'Takeaway Packaging',
                    nameAm: 'የማሸጊያ ዋጋ',
                    price: fee,
                    overridePrice: fee,
                  });
                }
              }}
            >
              <Icon name="plus" size={16} /> Add Custom Packaging Fee
            </button>
          </div>
        )}

        {/* Table selector */}
        {orderType === 'DINE_IN' && (
          <div style={{ marginTop: 'var(--space-2)' }}>
            <select
              className="input"
              value={tableNumber || ''}
              onChange={(e) => setTableNumber(e.target.value || null)}
              style={{ fontSize: '0.875rem', minHeight: '38px', padding: 'var(--space-2) var(--space-3)' }}
            >
              <option value="">{t('selectTable')}</option>
              {tables.map((tbl) => (
                <option key={tbl} value={tbl}>
                  {t('table', { number: tbl })}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Order Header */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex-between">
          <h3 style={{ fontSize: '0.9375rem' }}>
            {t('currentOrder')}
            {items.length > 0 && (
              <span style={{ color: 'var(--accent-emerald)', marginLeft: 'var(--space-2)', fontSize: '0.8125rem' }}>
                ({items.reduce((s, i) => s + i.quantity, 0)})
              </span>
            )}
          </h3>
          {items.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearCart} style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
              {t('clearOrder')}
            </button>
          )}
        </div>
      </div>

      {/* Items List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-10) var(--space-4)' }}>
            <div className="empty-state-icon"><Icon name="cart" size={40} /></div>
            <div className="empty-state-title">{t('emptyCart')}</div>
            <div className="empty-state-desc">{t('emptyCartDesc')}</div>
          </div>
        ) : (
          items.map((item) => {
            const uniqueKey = `${item.menuItemId}-${item.variantId || 'base'}`;
            return (
            <div key={uniqueKey} className="order-item">
              <div className="order-item-details">
                <div className="order-item-name">
                  {getLocaleName(item.nameEn, item.nameAm, locale)}
                  {item.variantId && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      ({getLocaleName(item.variantNameEn || '', item.variantNameAm || null, locale)})
                    </span>
                  )}
                </div>
                <div className="order-item-price">{formatPrice(item.price, locale)}</div>
              </div>
              <div className="order-item-qty">
                <button className="qty-btn" onClick={() => updateQuantity(item.menuItemId, item.variantId, item.quantity - 1)}>−</button>
                <span className="qty-value">{item.quantity}</span>
                <button className="qty-btn" onClick={() => updateQuantity(item.menuItemId, item.variantId, item.quantity + 1)}>+</button>
              </div>
              <div style={{ minWidth: '70px', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }}>
                {formatPrice(item.price * item.quantity, locale)}
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => removeItem(item.menuItemId, item.variantId)}
                style={{ color: 'var(--danger)', minHeight: '32px', minWidth: '32px' }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          )})
        )}
      </div>

      {/* Totals */}
      {items.length > 0 && (
        <div className="order-totals">
          <div className="order-total-row">
            <span className="order-total-label">{t('subtotal')}</span>
            <span className="order-total-amount">{formatPrice(getSubtotal(), locale)}</span>
          </div>
          {getDiscount() > 0 && (
            <div className="order-total-row">
              <span className="order-total-label" style={{ color: 'var(--accent-emerald)' }}>
                {t('discount')}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDiscount(0)}
                  style={{ padding: '0 4px', minHeight: 'auto', marginLeft: 'var(--space-2)', fontSize: '0.75rem' }}
                >
                  {tc('remove')}
                </button>
              </span>
              <span className="order-total-amount" style={{ color: 'var(--accent-emerald)' }}>
                −{formatPrice(getDiscount(), locale)}
              </span>
            </div>
          )}
          {getDiscount() === 0 && (
            <div className="order-total-row">
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleDiscount}
                style={{ padding: '0', minHeight: 'auto', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}
              >
                <Icon name="calculator" size={14} /> {t('discount')}
              </button>
              <span />
            </div>
          )}
          <div className="order-total-row">
            <span className="order-total-label">{t('tax')}</span>
            <span className="order-total-amount">{formatPrice(getTax(), locale)}</span>
          </div>
          <div className="order-total-row total">
            <span>{t('orderTotal')}</span>
            <span className="order-total-amount">{formatPrice(getTotal(), locale)}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
        {isWaiter ? (
          <button
            className="btn btn-primary btn-xl w-full"
            disabled={items.length === 0 || loading || (orderType === 'DINE_IN' && !tableNumber)}
            onClick={onPlaceOrder}
            style={{ flex: 1, background: 'var(--accent-gold)' }}
          >
            {loading ? tc('loading') : (orderType === 'DINE_IN' && !tableNumber && items.length > 0) ? (<><Icon name="alertTriangle" size={18} /> Select a Table</>) : (<><Icon name="kitchen" size={18} /> {t('sendToKitchen')}</>)}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
            {/* Order first: send to the kitchen without taking payment. */}
            <button
              className="btn btn-primary btn-xl"
              disabled={items.length === 0 || loading || (orderType === 'DINE_IN' && !tableNumber)}
              onClick={onPlaceOrder}
              style={{ flex: 1, background: 'var(--accent-gold)' }}
            >
              {loading ? tc('loading') : (orderType === 'DINE_IN' && !tableNumber && items.length > 0) ? (<><Icon name="alertTriangle" size={18} /> Select a Table</>) : (<><Icon name="kitchen" size={18} /> {t('sendToKitchen')}</>)}
            </button>
            {/* Or settle immediately (walk-in / takeout). */}
            <button
              className="btn btn-secondary btn-lg w-full"
              disabled={items.length === 0 || loading}
              onClick={onPay}
            >
              <Icon name="coins" size={18} /> {t('pay')} — {formatPrice(getTotal(), locale)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
