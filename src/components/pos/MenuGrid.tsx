'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocaleName, formatPrice } from '@/lib/utils';
import { useCartStore } from '@/features/orders/store';
import Icon from '@/components/shared/Icon';

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

interface MenuGridProps {
  items: MenuItem[];
}

export default function MenuGrid({ items }: MenuGridProps) {
  const locale = useLocale();
  const t = useTranslations('pos');
  const tc = useTranslations('common');
  const addItem = useCartStore((s) => s.addItem);
  const [animatingId, setAnimatingId] = useState<number | null>(null);
  const [selectedVariantItem, setSelectedVariantItem] = useState<MenuItem | null>(null);

  const filtered = items;

  const priceLabel = (item: MenuItem) => {
    if (item.variants && item.variants.length > 0) {
      const max = Math.max(0, ...item.variants.map((v) => v.priceOffset));
      if (max > 0) {
        return `${formatPrice(item.price, locale)} – ${formatPrice(item.price + max, locale)}`;
      }
    }
    return formatPrice(item.price, locale);
  };

  const handleAdd = (item: MenuItem) => {
    if (!item.isAvailable) return;
    
    // If item has variants, open selection modal
    if (item.variants && item.variants.length > 0) {
      setSelectedVariantItem(item);
      return;
    }

    // Otherwise add directly
    addItem({
      menuItemId: item.id,
      nameEn: item.nameEn,
      nameAm: item.nameAm,
      price: item.price,
    });
    setAnimatingId(item.id);
    setTimeout(() => setAnimatingId(null), 300);
  };

  if (filtered.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Icon name="search" size={40} /></div>
        <div className="empty-state-title">{t('itemUnavailable')}</div>
      </div>
    );
  }

  // Group items by category if we have category info
  const groupedItems: Record<string, MenuItem[]> = {};

  items.forEach(item => {
    const catName = getLocaleName(item.category?.nameEn || 'Uncategorized', item.category?.nameAm || null, locale);
    if (!groupedItems[catName]) {
      groupedItems[catName] = [];
    }
    groupedItems[catName].push(item);
  });

  const handleSelectVariant = (variant: {
    id: number;
    nameEn: string;
    nameAm: string | null;
    priceOffset: number;
  }) => {
    if (!selectedVariantItem) return;
    addItem({
      menuItemId: selectedVariantItem.id,
      variantId: variant.id,
      nameEn: selectedVariantItem.nameEn,
      nameAm: selectedVariantItem.nameAm,
      variantNameEn: variant.nameEn,
      variantNameAm: variant.nameAm,
      price: selectedVariantItem.price + variant.priceOffset,
    });
    setAnimatingId(selectedVariantItem.id);
    setTimeout(() => setAnimatingId(null), 300);
    setSelectedVariantItem(null);
  };

  return (
    <>
    <div className="menu-list-layout" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-10)', flex: 1, overflowY: 'auto' }}>
      {Object.entries(groupedItems).map(([categoryName, catItems]) => (
        <div key={categoryName} className="menu-category-section">
          <h2 className="menu-category-title">
            {categoryName}
          </h2>
          <div className="menu-grid">
            {catItems.map((item) => (
              <button
                key={item.id}
                className={`menu-item-btn ${!item.isAvailable ? 'unavailable' : ''} ${animatingId === item.id ? 'animate-popIn' : ''}`}
                onClick={() => handleAdd(item)}
                disabled={!item.isAvailable}
              >
                <span className="menu-item-thumb">
                  {item.image ? (
                    <img src={item.image} alt="" loading="lazy" />
                  ) : (
                    <span className="menu-item-thumb-fallback" aria-hidden="true">
                      <Icon name="flame" size={20} />
                    </span>
                  )}
                </span>
                <span className="menu-item-body">
                  <span className="menu-item-name">{getLocaleName(item.nameEn, item.nameAm, locale)}</span>
                  <span className="menu-item-meta">
                    <span className="menu-item-price">{priceLabel(item)}</span>
                    {item.variants && item.variants.length > 0 && (
                      <span className="menu-item-options">{item.variants.length} {t('options')}</span>
                    )}
                  </span>
                  {!item.isAvailable && <span className="menu-item-status">{t('itemUnavailable')}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* Variant Selection Modal */}
    {selectedVariantItem && (
      <div className="modal-overlay" onClick={() => setSelectedVariantItem(null)}>
        <div className="modal-content animate-popIn" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            {selectedVariantItem.image && (
              <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
                <img src={selectedVariantItem.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <h2 style={{ margin: 0, fontSize: '1.125rem' }}>
              {getLocaleName(selectedVariantItem.nameEn, selectedVariantItem.nameAm, locale)}
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {selectedVariantItem.variants?.map(v => (
              <button
                key={v.id}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', padding: 'var(--space-3)' }}
                onClick={() => handleSelectVariant(v)}
              >
                <span style={{ fontWeight: 600 }}>{getLocaleName(v.nameEn, v.nameAm, locale)}</span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                  {v.priceOffset !== 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {v.priceOffset > 0 ? '+' : ''}{formatPrice(v.priceOffset, locale)}
                    </span>
                  )}
                  <strong style={{ color: 'var(--accent-emerald)' }}>
                    {formatPrice(selectedVariantItem.price + v.priceOffset, locale)}
                  </strong>
                </span>
              </button>
            ))}
            <button className="btn btn-ghost" onClick={() => setSelectedVariantItem(null)} style={{ marginTop: 'var(--space-4)' }}>
              {tc('cancel')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
