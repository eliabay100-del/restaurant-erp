'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  getCategories,
  getAllMenuItems,
  toggleItemAvailability,
  createMenuItem,
  updateMenuItem,
  uploadMenuImage,
  createMenuVariant,
  deleteMenuVariant,
} from '@/features/menu/actions';
import { getLocaleName, formatPrice } from '@/lib/utils';
import Icon from '@/components/shared/Icon';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';

interface Variant {
  id: number;
  nameEn: string;
  nameAm: string | null;
  priceOffset: number;
}

interface Category {
  id: number; nameEn: string; nameAm: string | null; color: string | null; icon: string | null;
}

interface MenuItem {
  id: number; nameEn: string; nameAm: string | null; price: number; isAvailable: boolean; categoryId: number;
  image: string | null;
  category: { nameEn: string; nameAm: string | null; color: string | null };
  variants: Variant[];
}

const emptyForm = { nameEn: '', nameAm: '', price: '', image: '' };

/** Downscale an image in the browser so uploads stay small. */
async function prepareImage(file: File, maxDim = 900): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function MenuManagementPage() {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [portionForm, setPortionForm] = useState({ nameEn: '', nameAm: '', priceOffset: '' });

  const loadData = async () => {
    const [catRes, itemRes] = await Promise.all([getCategories(), getAllMenuItems()]);
    if (catRes.success) setCategories(catRes.categories as Category[]);
    if (itemRes.success) setItems(itemRes.items as MenuItem[]);
  };

  useAsyncEffect(loadData, []);

  const filteredItems = activeCategory ? items.filter((i) => i.categoryId === activeCategory) : items;
  const editingItem = editingId ? items.find((i) => i.id === editingId) ?? null : null;

  const handleToggle = async (id: number) => {
    await toggleItemAvailability(id);
    loadData();
  };

  const handleImageChange = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const blob = await prepareImage(file);
    const fd = new FormData();
    fd.append('file', blob, 'menu-image');
    const res = await uploadMenuImage(fd);
    setUploading(false);
    if (res.success && res.url) {
      setForm((f) => ({ ...f, image: res.url ?? '' }));
    } else {
      alert(res.error || 'Upload failed');
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowAddForm(!showAddForm);
  };

  const handleAdd = async () => {
    if (!form.nameEn || !form.price || !activeCategory) return;
    await createMenuItem({
      nameEn: form.nameEn,
      nameAm: form.nameAm || undefined,
      price: parseFloat(form.price),
      categoryId: activeCategory,
      image: form.image || undefined,
    });
    setForm(emptyForm);
    setShowAddForm(false);
    loadData();
  };

  const startEdit = (item: MenuItem) => {
    setShowAddForm(false);
    setEditingId(item.id);
    setPortionForm({ nameEn: '', nameAm: '', priceOffset: '' });
    setForm({
      nameEn: item.nameEn,
      nameAm: item.nameAm || '',
      price: String(item.price),
      image: item.image || '',
    });
  };

  const handleEdit = async () => {
    if (!editingId || !form.nameEn || !form.price) return;
    await updateMenuItem(editingId, {
      nameEn: form.nameEn,
      nameAm: form.nameAm || undefined,
      price: parseFloat(form.price),
      image: form.image || null,
    });
    setEditingId(null);
    setForm(emptyForm);
    loadData();
  };

  const handleAddPortion = async () => {
    if (!editingId || !portionForm.nameEn) return;
    await createMenuVariant({
      menuItemId: editingId,
      nameEn: portionForm.nameEn,
      nameAm: portionForm.nameAm || undefined,
      priceOffset: portionForm.priceOffset ? parseFloat(portionForm.priceOffset) : 0,
    });
    setPortionForm({ nameEn: '', nameAm: '', priceOffset: '' });
    loadData();
  };

  const handleDeletePortion = async (id: number) => {
    if (!window.confirm(t('deletePortionConfirm'))) return;
    await deleteMenuVariant(id);
    loadData();
  };

  const ImagePicker = (
    <div>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
        {t('image')}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: 'var(--radius-sm)', flexShrink: 0,
            border: '1px dashed var(--border)', background: 'var(--bg-card-hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}
        >
          {form.image
            ? <img src={form.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="image" size={22} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
            {uploading ? t('uploading') : form.image ? t('changeImage') : t('uploadImage')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={(e) => handleImageChange(e.target.files?.[0])}
            />
          </label>
          {form.image && (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setForm((f) => ({ ...f, image: '' }))}
            >
              {t('removeImage')}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="page-title">{t('menuManagement')}</div>
        {activeCategory && (
          <button className="btn btn-primary" onClick={openAdd}>
            {t('addItem')}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-5)' }}>
        {/* Categories sidebar */}
        <div style={{ width: '220px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('categories')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <button
              className={`sidebar-item ${activeCategory === null ? 'active' : ''}`}
              onClick={() => { setActiveCategory(null); setShowAddForm(false); setEditingId(null); }}
            >
              <span className="icon"><Icon name="menu" size={18} /></span> {tc('all')} ({items.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`sidebar-item ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => { setActiveCategory(cat.id); setShowAddForm(false); setEditingId(null); }}
              >
                <span className="icon">{cat.icon || <Icon name="folder" size={18} />}</span>
                {getLocaleName(cat.nameEn, cat.nameAm, locale)}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {items.filter((i) => i.categoryId === cat.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Items area */}
        <div style={{ flex: 1 }}>
          {/* Add form */}
          {showAddForm && (
            <div className="glass-card-static" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <h4 style={{ marginBottom: 'var(--space-3)' }}>{t('addItem')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 200px auto', gap: 'var(--space-3)', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('itemName')}</label>
                  <input className="input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="English name" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('itemNameAm')}</label>
                  <input className="input" value={form.nameAm} onChange={(e) => setForm({ ...form, nameAm: e.target.value })} placeholder="አማርኛ ስም" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('price')} (ETB)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                </div>
                {ImagePicker}
                <button className="btn btn-primary" onClick={handleAdd}>{tc('save')}</button>
              </div>
            </div>
          )}

          {/* Edit panel */}
          {editingItem && (
            <div className="glass-card-static" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                <h4>{t('editItem')}</h4>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                  {tc('cancel')}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 200px auto', gap: 'var(--space-3)', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('itemName')}</label>
                  <input className="input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('itemNameAm')}</label>
                  <input className="input" value={form.nameAm} onChange={(e) => setForm({ ...form, nameAm: e.target.value })} placeholder="አማርኛ" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('price')} (ETB)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                {ImagePicker}
                <button className="btn btn-primary" onClick={handleEdit}>{tc('save')}</button>
              </div>

              {/* Portions */}
              <div style={{ marginTop: 'var(--space-5)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
                <div className="flex-between" style={{ marginBottom: 'var(--space-2)' }}>
                  <h5 style={{ fontSize: '0.9375rem' }}>{t('portions')}</h5>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('portionHint')}</span>
                </div>

                {editingItem.variants.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>{t('noPortions')}</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    {editingItem.variants.map((v) => (
                      <div
                        key={v.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                          padding: '6px 10px', borderRadius: 'var(--radius-full)',
                          background: 'var(--bg-card-hover)', border: '1px solid var(--border)', fontSize: '0.8125rem',
                        }}
                      >
                        <strong>{getLocaleName(v.nameEn, v.nameAm, locale)}</strong>
                        <span style={{ color: 'var(--accent-emerald)' }}>
                          {formatPrice(editingItem.price + v.priceOffset, locale)}
                        </span>
                        {v.priceOffset !== 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            ({v.priceOffset > 0 ? '+' : ''}{formatPrice(v.priceOffset, locale)})
                          </span>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 6px' }}
                          onClick={() => handleDeletePortion(v.id)}
                          aria-label={tc('delete')}
                        >
                          <Icon name="x" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: 'var(--space-3)', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('portionName')}</label>
                    <input className="input" value={portionForm.nameEn} onChange={(e) => setPortionForm({ ...portionForm, nameEn: e.target.value })} placeholder="Small / Large" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('portionNameAm')}</label>
                    <input className="input" value={portionForm.nameAm} onChange={(e) => setPortionForm({ ...portionForm, nameAm: e.target.value })} placeholder="ትንሽ / ትልቅ" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{t('priceOffset')} (ETB)</label>
                    <input className="input" type="number" step="0.01" value={portionForm.priceOffset} onChange={(e) => setPortionForm({ ...portionForm, priceOffset: e.target.value })} placeholder="0.00" />
                  </div>
                  <button className="btn btn-secondary" onClick={handleAddPortion}>
                    {t('addPortion')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Items grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="glass-card-static"
                style={{
                  padding: 'var(--space-3)', opacity: item.isAvailable ? 1 : 0.5,
                  borderLeft: `3px solid ${item.category?.color || 'var(--accent-emerald)'}`,
                  display: 'flex', gap: 'var(--space-3)', alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 56, height: 56, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                    background: 'var(--bg-card-hover)', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {item.image
                    ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon name="image" size={20} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex-between" style={{ gap: 'var(--space-2)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getLocaleName(item.nameEn, item.nameAm, locale)}
                      </div>
                      {item.nameAm && locale !== 'am' && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.nameAm}</div>
                      )}
                      {item.variants.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {item.variants.length} {t('portions').toLowerCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--accent-emerald)', whiteSpace: 'nowrap' }}>
                      {formatPrice(item.price, locale)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(item)}><Icon name="edit" size={15} /> {tc('edit')}</button>
                    <button
                      className={`btn btn-sm ${item.isAvailable ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => handleToggle(item.id)}
                    >
                      {item.isAvailable ? t('available') : t('unavailable')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="menu" size={48} /></div>
              <div className="empty-state-title">No items in this category</div>
              <div className="empty-state-desc">Add items to this category using the button above</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
