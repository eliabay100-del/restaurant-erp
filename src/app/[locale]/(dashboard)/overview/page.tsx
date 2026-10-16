'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getDailySummary, getSalesByHour, getRecentOrders } from '@/features/dashboard/actions';
import { formatPrice, formatTime, getStatusBadgeClass } from '@/lib/utils';
import Icon, { type IconName } from '@/components/shared/Icon';

export default function OverviewPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [summary, setSummary] = useState<{ totalSales: number; orderCount: number; averageOrder: number; activeOrders: number } | null>(null);
  const [hourly, setHourly] = useState<{ hour: number; total: number; count: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<Array<{
    id: number; orderNumber: string; status: string; total: number; createdAt: string;
    type: string; tableNumber: string | null; items: { id: number }[];
    staff: { name: string; nameAm: string | null };
  }>>([]);

  useEffect(() => {
    async function load() {
      const [sumResult, hourResult, orderResult] = await Promise.all([
        getDailySummary(),
        getSalesByHour(),
        getRecentOrders(10),
      ]);
      if (sumResult.success && sumResult.data) setSummary(sumResult.data);
      if (hourResult.success && hourResult.data) setHourly(hourResult.data as typeof hourly);
      if (orderResult.success && orderResult.orders) setRecentOrders(orderResult.orders as typeof recentOrders);
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const maxHourlySales = Math.max(...hourly.map((h) => h.total), 1);

  const statCards: { label: string; value: string; icon: IconName; color: string }[] = summary ? [
    { label: t('todaySales'), value: formatPrice(summary.totalSales, locale), icon: 'coins', color: 'var(--accent-green)' },
    { label: t('ordersCount'), value: String(summary.orderCount), icon: 'orders', color: 'var(--accent-blue)' },
    { label: t('averageOrder'), value: formatPrice(summary.averageOrder, locale), icon: 'chartBar', color: 'var(--accent-emerald)' },
    { label: t('activeOrders'), value: String(summary.activeOrders), icon: 'flame', color: 'var(--accent-purple)' },
  ] : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('overview')}</div>
          <div className="page-subtitle">{tc('today')}</div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-6)' }}>
        {statCards.map((card) => (
          <div key={card.label} className="stat-card" style={{ borderLeft: `3px solid ${card.color}` }}>
            <div className="stat-card-label"><Icon name={card.icon} size={14} /> {card.label}</div>
            <div className="stat-card-value" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Sales by Hour Chart */}
      <div className="glass-card-static panel" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>{t('salesByHour')}</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '180px', padding: '0 var(--space-2)' }}>
          {hourly.filter((h) => h.hour >= 6 && h.hour <= 23).map((h) => (
            <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                background: h.total > 0 ? 'linear-gradient(to top, var(--accent-emerald), var(--accent-emerald-light))' : 'var(--bg-card)',
                height: `${Math.max((h.total / maxHourlySales) * 150, 4)}px`,
                transition: 'height 0.5s ease',
                minHeight: '4px',
              }} title={`${formatPrice(h.total, locale)} (${h.count} orders)`} />
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{h.hour}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="glass-card-static" style={{ overflow: 'hidden' }}>
        <div className="panel-header">
          <h3 className="section-title">{t('recentOrders')}</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Type</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 600 }}>{order.orderNumber.split('-').pop()}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{formatTime(order.createdAt)}</td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{order.type === 'DINE_IN' ? (<><Icon name="menu" size={14} /> T{order.tableNumber || '-'}</>) : (<Icon name="inventory" size={14} />)}</span></td>
                  <td>{order.items.length}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>{formatPrice(order.total, locale)}</td>
                  <td><span className={`badge ${getStatusBadgeClass(order.status)}`}>{order.status}</span></td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-8)' }}>No orders yet today</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
