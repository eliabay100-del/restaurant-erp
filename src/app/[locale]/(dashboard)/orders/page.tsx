'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getOrderHistory } from '@/features/orders/actions';
import { formatPrice, formatTime, getStatusBadgeClass, getLocaleName } from '@/lib/utils';
import { ORDER_STATUSES } from '@/lib/orderStatus';
import Icon from '@/components/shared/Icon';
import { ReceiptModal, type ReceiptData } from '@/components/shared/Receipt';

interface OrderData {
  id: number;
  orderNumber: string;
  type: string;
  status: string;
  tableNumber: string | null;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  note: string | null;
  createdAt: string;
  items: { id: number; itemNameEn: string; itemNameAm: string | null; quantity: number; unitPrice: number; totalPrice: number; note: string | null }[];
  staff: { name: string; nameAm: string | null };
  payment: { method: string; amountPaid: number; amountDue: number; changeGiven: number; reference: string | null; verificationStatus: string | null } | null;
}

export default function OrdersPage() {
  const t = useTranslations('orders');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getOrderHistory(page, 15, statusFilter || undefined);
      if (result.success) {
        setOrders(result.orders as OrderData[]);
        setTotalPages(result.pages);
      }
    }
    load();
  }, [page, statusFilter]);

  const statuses = ['', ...ORDER_STATUSES];

  const viewReceipt = (order: OrderData) => {
    if (!order.payment) return;
    setReceipt({
      orderNumber: order.orderNumber,
      type: order.type,
      tableNumber: order.tableNumber,
      subtotal: order.subtotal,
      discount: order.discount,
      taxAmount: order.taxAmount,
      total: order.total,
      note: order.note,
      createdAt: order.createdAt,
      staffName: order.staff.name,
      staffNameAm: order.staff.nameAm,
      lines: order.items.map((i) => ({
        nameEn: i.itemNameEn,
        nameAm: i.itemNameAm,
        qty: i.quantity,
        unitPrice: i.unitPrice,
        total: i.totalPrice,
        note: i.note,
      })),
      payment: {
        method: order.payment.method,
        amountPaid: order.payment.amountPaid,
        amountDue: order.payment.amountDue,
        changeGiven: order.payment.changeGiven,
        reference: order.payment.reference,
        verificationStatus: order.payment.verificationStatus,
      },
    });
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="page-title">{t('orderHistory')}</div>
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ width: '200px', minHeight: '40px' }}
        >
          <option value="">{tc('all')}</option>
          {statuses.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="glass-card-static" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Time</th>
              <th>Type</th>
              <th>Items</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Staff</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <>
                <tr key={order.id} onClick={() => setExpandedId(expandedId === order.id ? null : order.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{order.orderNumber.split('-').pop()}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{formatTime(order.createdAt)}</td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{order.type === 'DINE_IN' ? (<><Icon name="menu" size={14} /> T{order.tableNumber || '-'}</>) : (<Icon name="inventory" size={14} />)}</span></td>
                  <td>{order.items.length}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>{formatPrice(order.total, locale)}</td>
                  <td>{order.payment ? (order.payment.method === 'CASH' ? <Icon name="banknote" size={16} /> : <Icon name="creditCard" size={16} />) : '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{getLocaleName(order.staff.name, order.staff.nameAm, locale)}</td>
                  <td><span className={`badge ${getStatusBadgeClass(order.status)}`}>{order.status}</span></td>
                </tr>
                {expandedId === order.id && (
                  <tr key={`${order.id}-details`}>
                    <td colSpan={8} style={{ background: 'var(--bg-card)', padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                        <div>
                          <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.875rem' }}>Items:</h4>
                          {order.items.map((item) => (
                            <div key={item.id} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', padding: '2px 0' }}>
                              {item.quantity}× {getLocaleName(item.itemNameEn, item.itemNameAm, locale)}
                            </div>
                          ))}
                        </div>
                        {order.payment && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => { e.stopPropagation(); viewReceipt(order); }}
                            style={{ height: 'fit-content' }}
                          >
                            <Icon name="creditCard" size={16} /> View Receipt
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-10)' }}>{t('noOrders')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><Icon name="chevronLeft" size={16} /></button>
          <span style={{ padding: 'var(--space-2) var(--space-4)', color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Next page"><Icon name="chevronRight" size={16} /></button>
        </div>
      )}

      {receipt && <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
