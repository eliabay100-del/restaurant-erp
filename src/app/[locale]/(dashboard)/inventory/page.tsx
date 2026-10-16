'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getInventoryItems, createInventoryItem, addStockTransaction, getInventorySummary } from '@/features/inventory/actions';
import { formatPrice, getLocaleName } from '@/lib/utils';
import { useAuth } from '@/context/AuthProvider';
import Icon from '@/components/shared/Icon';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';

interface InventoryItemData {
  id: number; nameEn: string; nameAm: string | null; category: string; unit: string;
  currentStock: number; unitCost: number; reorderLevel: number; supplier: string | null;
  transactions: { id: number; type: string; quantity: number; createdAt: string }[];
}

interface Summary { totalItems: number; totalValue: number; lowStockCount: number; outOfStockCount: number; }

export default function InventoryPage() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { staff } = useAuth();
  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [stockAction, setStockAction] = useState<{ id: number; type: string } | null>(null);
  const [form, setForm] = useState({ nameEn: '', nameAm: '', category: 'RAW_MATERIAL', unit: 'kg', unitCost: '', reorderLevel: '', supplier: '', stock: '' });
  const [stockForm, setStockForm] = useState({ quantity: '', unitCost: '', note: '' });

  const loadData = async () => {
    const [itemRes, sumRes] = await Promise.all([
      getInventoryItems(filter || undefined),
      getInventorySummary(),
    ]);
    if (itemRes.success) setItems(itemRes.items as InventoryItemData[]);
    if (sumRes.success && sumRes.data) setSummary(sumRes.data as Summary);
  };

  useAsyncEffect(loadData, [filter]);

  const handleAdd = async () => {
    if (!form.nameEn) return;
    await createInventoryItem({
      nameEn: form.nameEn, nameAm: form.nameAm || undefined, category: form.category,
      unit: form.unit, unitCost: parseFloat(form.unitCost) || 0,
      reorderLevel: parseFloat(form.reorderLevel) || 0, supplier: form.supplier || undefined,
      currentStock: parseFloat(form.stock) || 0,
    });
    setForm({ nameEn: '', nameAm: '', category: 'RAW_MATERIAL', unit: 'kg', unitCost: '', reorderLevel: '', supplier: '', stock: '' });
    setShowAddForm(false);
    loadData();
  };

  const handleStockAction = async () => {
    if (!stockAction || !stockForm.quantity) return;
    await addStockTransaction({
      inventoryItemId: stockAction.id,
      type: stockAction.type,
      quantity: parseFloat(stockForm.quantity) || 0,
      unitCost: parseFloat(stockForm.unitCost) || undefined,
      note: stockForm.note || undefined,
      staffId: staff?.id,
    });
    setStockAction(null);
    setStockForm({ quantity: '', unitCost: '', note: '' });
    loadData();
  };

  const getStockStatus = (item: InventoryItemData) => {
    if (item.currentStock <= 0) return { label: t('outOfStock'), color: 'var(--danger)', badge: 'badge-cancelled' };
    if (item.reorderLevel > 0 && item.currentStock <= item.reorderLevel) return { label: t('lowStock'), color: 'var(--warning)', badge: 'badge-preparing' };
    return { label: t('inStock'), color: 'var(--success)', badge: 'badge-ready' };
  };

  const units = ['kg', 'g', 'l', 'ml', 'pcs', 'box', 'bag', 'bottle'];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="page-title">{t('title')}</div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: '180px', minHeight: '38px' }}>
            <option value="">{tc('all')}</option>
            <option value="RAW_MATERIAL">{t('rawMaterials')}</option>
            <option value="MISC">{t('miscItems')}</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>+ {t('addItem')}</button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
            <div className="stat-card-label"><Icon name="inventory" size={14} /> {t('totalItems')}</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-blue)' }}>{summary.totalItems}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-gold)' }}>
            <div className="stat-card-label"><Icon name="coins" size={14} /> {t('totalValue')}</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-gold)' }}>{formatPrice(summary.totalValue, locale)}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--warning)' }}>
            <div className="stat-card-label"><Icon name="alertTriangle" size={14} /> {t('lowStock')}</div>
            <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{summary.lowStockCount}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--danger)' }}>
            <div className="stat-card-label"><Icon name="xCircle" size={14} /> {t('outOfStock')}</div>
            <div className="stat-card-value" style={{ color: 'var(--danger)' }}>{summary.outOfStockCount}</div>
          </div>
        </div>
      )}

      {/* Add Item Form */}
      {showAddForm && (
        <div className="glass-card-static panel" style={{ marginBottom: 'var(--space-5)' }}>
          <h3 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>{t('addItem')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
            <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('itemName')} *</label>
              <input className="input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></div>
            <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('itemNameAm')}</label>
              <input className="input" value={form.nameAm} onChange={(e) => setForm({ ...form, nameAm: e.target.value })} placeholder="አማርኛ" /></div>
            <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('category')}</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="RAW_MATERIAL">{t('rawMaterials')}</option>
                <option value="MISC">{t('miscItems')}</option>
              </select></div>
            <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('unit')}</label>
              <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select></div>
            <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('quantity')}</label>
              <input className="input" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
            <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('unitCost')} (ETB)</label>
              <input className="input" type="number" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></div>
            <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('reorderLevel')}</label>
              <input className="input" type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
            <div><label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('supplier')}</label>
              <input className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
            <button className="btn btn-primary" onClick={handleAdd}>{tc('save')}</button>
            <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>{tc('cancel')}</button>
          </div>
        </div>
      )}

      {/* Inventory Items Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
        {items.map((item) => {
          const status = getStockStatus(item);
          return (
            <div key={item.id} className="glass-card-static" style={{ padding: 'var(--space-4)' }}>
              <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                <div>
                  <h3 style={{ fontSize: '0.9375rem' }}>{getLocaleName(item.nameEn, item.nameAm, locale)}</h3>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                    <span className="badge" style={{ fontSize: '0.6875rem' }}>{item.category === 'RAW_MATERIAL' ? t('rawMaterials') : t('miscItems')}</span>
                    <span className={`badge ${status.badge}`} style={{ fontSize: '0.6875rem' }}>{status.label}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: status.color }}>
                    {item.currentStock} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.unit}</span>
                  </div>
                  {item.reorderLevel > 0 && (
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>min: {item.reorderLevel} {item.unit}</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                <span>{t('unitCost')}: <strong style={{ color: 'var(--accent-gold)' }}>{formatPrice(item.unitCost, locale)}</strong></span>
                {item.supplier && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="inventory" size={13} /> {item.supplier}</span>}
              </div>

              {/* Stock action buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setStockAction({ id: item.id, type: 'PURCHASE' })}>+ {t('purchase')}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setStockAction({ id: item.id, type: 'USAGE' })}>− {t('usage')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setStockAction({ id: item.id, type: 'WASTAGE' })} style={{ color: 'var(--danger)' }}><Icon name="trash" size={15} /> {t('wastage')}</button>
              </div>

              {/* Stock Action Form */}
              {stockAction?.id === item.id && (
                <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.8125rem', marginBottom: 'var(--space-2)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {stockAction.type === 'PURCHASE' ? (<><Icon name="download" size={15} /> {t('purchase')}</>) : stockAction.type === 'USAGE' ? (<><Icon name="upload" size={15} /> {t('usage')}</>) : (<><Icon name="trash" size={15} /> {t('wastage')}</>)}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                    <div><label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{t('quantity')} ({item.unit})</label>
                      <input className="input" type="number" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} /></div>
                    {stockAction.type === 'PURCHASE' && (
                      <div><label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{t('unitCost')}</label>
                        <input className="input" type="number" value={stockForm.unitCost} onChange={(e) => setStockForm({ ...stockForm, unitCost: e.target.value })} placeholder={String(item.unitCost)} /></div>
                    )}
                  </div>
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <input className="input" value={stockForm.note} onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })} placeholder="Note..." />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleStockAction}>{tc('confirm')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setStockAction(null)}>{tc('cancel')}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="inventory" size={48} /></div>
          <div className="empty-state-title">{t('noItems')}</div>
        </div>
      )}
    </div>
  );
}
