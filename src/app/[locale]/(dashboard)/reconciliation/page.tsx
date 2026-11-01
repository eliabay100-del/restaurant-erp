'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate, formatDateTime, getLocaleName } from '@/lib/utils';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import {
  getRecipeEditorData,
  saveRecipeYield,
  deleteRecipeIngredient,
  getAssignmentBoard,
  saveStockAssignments,
  getSettlement,
} from '@/features/inventory/reconciliation';

type Tab = 'recipes' | 'assign' | 'settlement';
type PeriodType = 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

interface IngredientRow {
  id: number;
  inventoryItemId: number;
  stockNameEn: string;
  stockNameAm: string | null;
  unit: string;
  quantity: number;
  yieldStockQuantity: number | null;
  yieldUnits: number | null;
  exactPerUnit: number;
  perUnit: number;
}

interface MenuRow {
  id: number;
  nameEn: string;
  nameAm: string | null;
  category: { id: number; nameEn: string; nameAm: string | null };
  ingredients: IngredientRow[];
}

interface InventoryOption {
  id: number;
  nameEn: string;
  nameAm: string | null;
  unit: string;
  currentStock: number;
}

interface StockRow {
  id: number;
  nameEn: string;
  nameAm: string | null;
  unit: string;
  currentStock: number;
  tracked: boolean;
  assigned: number;
  note: string;
  assignedByName: string | null;
}

interface SettlementRow {
  id: number;
  nameEn: string;
  nameAm: string | null;
  unit: string;
  assigned: number;
  expected: number;
  remaining: number;
}

interface UsageLine {
  inventoryItemId: number;
  nameEn: string;
  nameAm: string | null;
  unit: string;
  quantity: number;
}

interface SettlementOrder {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  channel: string;
  createdAt: string | Date;
  confirmedAt: string | Date | null;
  deliveredAt: string | Date | null;
  staffName: string | null;
  kitchenStatus: string | null;
  items: { nameEn: string; nameAm: string | null; quantity: number }[];
  usage: UsageLine[];
}

interface SettlementResult {
  summary: SettlementRow[];
  orders: SettlementOrder[];
  totals: { assigned: number; expected: number; assignedItems: number; expectedItems: number; orders: number };
}

interface Period {
  start: Date;
  end: Date;
}

function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function computePeriod(
  type: PeriodType,
  anchor: string,
  customStart: string,
  customEnd: string
): Period {
  if (type === 'CUSTOM') {
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59.999`);
    return { start, end };
  }

  const base = new Date(`${anchor}T00:00:00`);
  if (type === 'DAY') return { start: startOfDay(base), end: endOfDay(base) };

  if (type === 'WEEK') {
    // Monday-first week (matches Ethiopian business weeks).
    const offset = (base.getDay() + 6) % 7;
    const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { start: startOfDay(monday), end: endOfDay(sunday) };
  }

  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { start: startOfDay(first), end: endOfDay(last) };
}

export default function ReconciliationPage() {
  const t = useTranslations('reconciliation');
  const shortName = (en: string, am: string | null) => (getLocaleName(en, am, locale) || '').trim().split(/\s+/).pop() || getLocaleName(en, am, locale);
  const locale = useLocale();

  const [tab, setTab] = useState<Tab>('recipes');

  // ---- Section 1: recipes -------------------------------------------------
  const [menuItems, setMenuItems] = useState<MenuRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [recipeForm, setRecipeForm] = useState({ inventoryItemId: '', stockQty: '', units: '' });
  const [editingIngredientId, setEditingIngredientId] = useState<number | null>(null);
  const [recipeMsg, setRecipeMsg] = useState('');
  const [recipeError, setRecipeError] = useState('');
  const [savingRecipe, setSavingRecipe] = useState(false);

  // ---- Period shared by sections 2 & 3 ------------------------------------
  const [periodType, setPeriodType] = useState<PeriodType>('WEEK');
  const [anchor, setAnchor] = useState(() => toDateInput(new Date()));
  const [customStart, setCustomStart] = useState(() => toDateInput(new Date()));
  const [customEnd, setCustomEnd] = useState(() => toDateInput(new Date()));
  const period = useMemo(
    () => computePeriod(periodType, anchor, customStart, customEnd),
    [periodType, anchor, customStart, customEnd]
  );
  const periodStartIso = period.start.toISOString();
  const periodEndIso = period.end.toISOString();

  // ---- Section 2: assignments --------------------------------------------
  const [board, setBoard] = useState<StockRow[]>([]);
  const [assignRows, setAssignRows] = useState<Record<number, { quantity: string; note: string }>>({});
  const [assignMsg, setAssignMsg] = useState('');
  const [assignError, setAssignError] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(false);

  // ---- Section 3: settlement ---------------------------------------------
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [settlementError, setSettlementError] = useState('');
  const [loadingSettlement, setLoadingSettlement] = useState(false);

  const selectedMenu = menuItems.find((m) => m.id === selectedMenuId) ?? null;
  const selectedStock = inventoryItems.find((i) => i.id === Number(recipeForm.inventoryItemId)) ?? null;

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter(
      (m) =>
        m.nameEn.toLowerCase().includes(q) ||
        (m.nameAm ?? '').toLowerCase().includes(q) ||
        m.category.nameEn.toLowerCase().includes(q)
    );
  }, [menuItems, search]);

  const loadRecipes = async () => {
    const r = await getRecipeEditorData();
    if (r.success) {
      setMenuItems(r.menuItems as MenuRow[]);
      setInventoryItems(r.inventoryItems as InventoryOption[]);
    } else {
      setRecipeError(r.error || t('common.loading'));
    }
  };

  const loadBoard = async () => {
    setLoadingBoard(true);
    const r = await getAssignmentBoard(periodStartIso, periodEndIso);
    if (r.success) {
      setBoard(r.items as StockRow[]);
      const next: Record<number, { quantity: string; note: string }> = {};
      for (const item of r.items as StockRow[]) {
        next[item.id] = { quantity: item.assigned ? String(item.assigned) : '', note: item.note ?? '' };
      }
      setAssignRows(next);
    } else {
      setAssignError(r.error || 'Failed to load assignments');
    }
    setLoadingBoard(false);
  };

  const loadSettlement = async () => {
    setLoadingSettlement(true);
    const r = await getSettlement(periodStartIso, periodEndIso);
    if (r.success) {
      setSettlement({
        summary: r.summary as SettlementRow[],
        orders: r.orders as SettlementOrder[],
        totals: r.totals as SettlementResult['totals'],
      });
    } else {
      setSettlementError(r.error || 'Failed to load settlement');
    }
    setLoadingSettlement(false);
  };

  useAsyncEffect(loadRecipes, []);

  useAsyncEffect(async () => {
    if (tab === 'assign') await loadBoard();
    if (tab === 'settlement') await loadSettlement();
  }, [tab, periodStartIso, periodEndIso]);

  const selectMenu = (id: number) => {
    setSelectedMenuId(id);
    setEditingIngredientId(null);
    setRecipeForm({ inventoryItemId: '', stockQty: '', units: '' });
    setRecipeMsg('');
    setRecipeError('');
  };

  const startEditIngredient = (ing: IngredientRow) => {
    setEditingIngredientId(ing.id);
    setRecipeForm({
      inventoryItemId: String(ing.inventoryItemId),
      // Legacy recipes only have a per-unit quantity, so treat it as "quantity
      // produces 1 item" until the user enters a batch yield.
      stockQty: String(ing.yieldStockQuantity ?? ing.quantity),
      units: String(ing.yieldUnits ?? 1),
    });
    setRecipeMsg('');
    setRecipeError('');
    document.getElementById('recipe-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleStockChange = (value: string) => {
    const existing = selectedMenu?.ingredients.find((i) => i.inventoryItemId === Number(value));
    setEditingIngredientId(existing?.id ?? null);
    setRecipeForm({
      inventoryItemId: value,
      stockQty: existing ? String(existing.yieldStockQuantity ?? existing.quantity) : '',
      units: existing ? String(existing.yieldUnits ?? 1) : '',
    });
    setRecipeMsg('');
    setRecipeError('');
  };

  const cancelEdit = () => {
    setEditingIngredientId(null);
    setRecipeForm({ inventoryItemId: '', stockQty: '', units: '' });
    setRecipeMsg('');
    setRecipeError('');
  };

  const handleSaveRecipe = async () => {
    if (!selectedMenuId) return;
    setSavingRecipe(true);
    setRecipeMsg('');
    setRecipeError('');
    const r = await saveRecipeYield({
      menuItemId: selectedMenuId,
      inventoryItemId: Number(recipeForm.inventoryItemId),
      yieldStockQuantity: Number(recipeForm.stockQty),
      yieldUnits: Number(recipeForm.units),
    });
    if (r.success) {
      setRecipeMsg(r.message || t('recipes.saved'));
      setEditingIngredientId(null);
      setRecipeForm({ inventoryItemId: '', stockQty: '', units: '' });
      await loadRecipes();
    } else {
      setRecipeError(r.error || 'Failed to save recipe');
    }
    setSavingRecipe(false);
  };

  const handleDeleteIngredient = async (id: number) => {
    const r = await deleteRecipeIngredient(id);
    if (r.success) {
      if (editingIngredientId === id) cancelEdit();
      await loadRecipes();
    } else {
      setRecipeError(r.error || 'Failed to remove recipe line');
    }
  };

  const handleSaveAssignments = async () => {
    setSavingAssign(true);
    setAssignMsg('');
    setAssignError('');
    const lines = board.map((item) => ({
      inventoryItemId: item.id,
      quantity: Number(assignRows[item.id]?.quantity ?? 0) || 0,
      note: assignRows[item.id]?.note || undefined,
    }));
    const r = await saveStockAssignments({
      periodType,
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
      lines,
    });
    if (r.success) {
      setAssignMsg(r.message || t('assign.saved'));
      await loadBoard();
    } else {
      setAssignError(r.error || 'Failed to save assignments');
    }
    setSavingAssign(false);
  };

  const assignmentSummary = useMemo(() => {
    let items = 0;
    for (const row of Object.values(assignRows)) {
      if ((Number(row.quantity) || 0) > 0) items += 1;
    }
    return { items };
  }, [assignRows]);

  const renderPeriodControls = () => (
    <div
      className="glass-card-static"
      style={{
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-4)',
        display: 'flex',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
      }}
    >
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(['DAY', 'WEEK', 'MONTH', 'CUSTOM'] as PeriodType[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`btn btn-sm ${periodType === p ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPeriodType(p)}
          >
            {p === 'DAY' ? t('assign.today') : p === 'WEEK' ? t('assign.thisWeek') : p === 'MONTH' ? t('assign.thisMonth') : t('assign.custom')}
          </button>
        ))}
      </div>

      {periodType !== 'CUSTOM' ? (
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
          {t('assign.period')}
          <input
            type="date"
            className="input"
            style={{ width: 170 }}
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
          />
        </label>
      ) : (
        <>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            {t('assign.from')}
            <input
              type="date"
              className="input"
              style={{ width: 170 }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            {t('assign.to')}
            <input
              type="date"
              className="input"
              style={{ width: 170 }}
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </label>
        </>
      )}

      <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
        {formatDate(period.start, locale)} — {formatDate(period.end, locale)}
      </div>
    </div>
  );

  const renderRecipes = () => (
    <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {/* Menu picker */}
      <div className="glass-card-static panel" style={{ padding: 'var(--space-4)' }}>
        <div className="section-title" style={{ marginBottom: 'var(--space-3)' }}>{t('recipes.selectItem')}</div>
        <input
          className="input"
          placeholder={t('recipes.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 'var(--space-3)' }}
        />
        <div style={{ maxHeight: 460, overflowY: 'auto', display: 'grid', gap: 4 }}>
          {filteredMenu.map((menu) => (
            <button
              key={menu.id}
              type="button"
              className={`btn btn-sm ${selectedMenuId === menu.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => selectMenu(menu.id)}
            >
              <span style={{ display: 'grid', gap: 2 }}>
                <span>{shortName(menu.nameEn, menu.nameAm)}</span>
                <span style={{ fontSize: 11, opacity: 0.75 }}>
                  {shortName(menu.category.nameEn, menu.category.nameAm)}
                  {menu.ingredients.length > 0 ? ` · ${menu.ingredients.length} ${t('recipes.existing')}` : ''}
                </span>
              </span>
            </button>
          ))}
          {filteredMenu.length === 0 && <div className="text-muted">{t('common.none')}</div>}
        </div>
      </div>

      {/* Recipe editor */}
      <div className="glass-card-static panel" style={{ padding: 'var(--space-4)' }}>
        {!selectedMenu ? (
          <div className="empty-state" style={{ padding: 'var(--space-5)' }}>
            <div className="empty-state-title">{t('recipes.intro')}</div>
            <div className="empty-state-desc">{t('recipes.example')}</div>
          </div>
        ) : (
          <>
            <div className="page-title" style={{ fontSize: '1.15rem' }}>{shortName(selectedMenu.nameEn, selectedMenu.nameAm)}</div>
            <div className="text-muted" style={{ fontSize: 12, marginBottom: 'var(--space-4)' }}>
              {shortName(selectedMenu.category.nameEn, selectedMenu.category.nameAm)} · {t('recipes.intro')}
            </div>

            <div className="section-title" style={{ marginBottom: 'var(--space-2)' }}>{t('recipes.existing')}</div>
            {selectedMenu.ingredients.length === 0 ? (
              <div className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>{t('recipes.noRecipe')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 6, marginBottom: 'var(--space-4)' }}>
                {selectedMenu.ingredients.map((ing) => (
                  <div
                    key={ing.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{shortName(ing.stockNameEn, ing.stockNameAm)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {ing.yieldStockQuantity && ing.yieldUnits
                          ? `${ing.yieldStockQuantity} ${ing.unit} → ${ing.yieldUnits} × ${shortName(selectedMenu.nameEn, selectedMenu.nameAm)}`
                          : `${ing.perUnit} ${ing.unit} / ${t('recipes.perUnit')}`}
                        {' · '}
                        {ing.exactPerUnit.toFixed(2)} {ing.unit} / {t('recipes.perUnit')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEditIngredient(ing)}>
                        {t('recipes.edit')}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteIngredient(ing.id)}>
                        {t('recipes.remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div id="recipe-form" style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('recipes.stockItem')}</label>
                <select
                  className="input"
                  value={recipeForm.inventoryItemId}
                  onChange={(e) => handleStockChange(e.target.value)}
                >
                  <option value="">{t('common.none')}</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {shortName(item.nameEn, item.nameAm)} ({item.unit}) · {item.currentStock} {item.unit}
                    </option>
                  ))}
                </select>
              </div>

              {editingIngredientId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-gold)' }}>
                  <span>
                    {t('recipes.editing')}
                    {selectedStock ? `: ${shortName(selectedStock.nameEn, selectedStock.nameAm)}` : ''}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                    {t('recipes.cancel')}
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gap: 'var(--space-2)', gridTemplateColumns: '1fr 1fr' }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  {t('recipes.stockQuantity')} {selectedStock ? `(${selectedStock.unit})` : ''}
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={recipeForm.stockQty}
                    onChange={(e) => setRecipeForm({ ...recipeForm, stockQty: e.target.value })}
                    placeholder="1000"
                  />
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  {t('recipes.unitsProduced')}
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={recipeForm.units}
                    onChange={(e) => setRecipeForm({ ...recipeForm, units: e.target.value })}
                    placeholder="100"
                  />
                </label>
              </div>

              {Number(recipeForm.stockQty) > 0 && Number(recipeForm.units) > 0 && selectedStock && (
                <div style={{ fontSize: 13, color: 'var(--accent-emerald)', fontWeight: 600 }}>
                  {t('recipes.preview', {
                    stock: Number(recipeForm.stockQty),
                    unit: selectedStock.unit,
                    units: Number(recipeForm.units),
                    per: (Number(recipeForm.stockQty) / Number(recipeForm.units)).toFixed(2),
                  })}
                </div>
              )}

              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('recipes.example')}</div>

              <button
                type="button"
                className="btn btn-primary"
                disabled={savingRecipe || !recipeForm.inventoryItemId || !recipeForm.stockQty || !recipeForm.units}
                onClick={handleSaveRecipe}
              >
                {savingRecipe ? t('common.saving') : editingIngredientId ? t('recipes.update') : t('recipes.save')}
              </button>
            </div>

            {recipeMsg && <div style={{ marginTop: 'var(--space-3)', color: 'var(--success)', fontSize: 13 }}>{recipeMsg}</div>}
            {recipeError && <div style={{ marginTop: 'var(--space-3)', color: 'var(--danger)', fontSize: 13 }}>{recipeError}</div>}
          </>
        )}
      </div>
    </div>
  );

  const renderAssign = () => (
    <div>
      {renderPeriodControls()}

      <div className="kpi-grid" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="stat-card">
          <div className="stat-card-label">{t('assign.itemsAssigned')}</div>
          <div className="stat-card-value">{assignmentSummary.items}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">{t('assign.inventoryItems')}</div>
          <div className="stat-card-value">{board.length}</div>
        </div>
      </div>

      <div className="glass-card-static panel" style={{ padding: 'var(--space-4)' }}>
        <div className="page-header" style={{ marginBottom: 'var(--space-3)' }}>
          <div>
            <div className="section-title">{t('tabs.assign')}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>{t('assign.intro')}</div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={savingAssign || loadingBoard} onClick={handleSaveAssignments}>
            {savingAssign ? t('common.saving') : t('assign.save')}
          </button>
        </div>

        {loadingBoard ? (
          <div className="text-muted">{t('common.loading')}</div>
        ) : board.length === 0 ? (
          <div className="text-muted">{t('assign.empty')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('assign.item')}</th>
                  <th>{t('assign.currentStock')}</th>
                  <th>{t('assign.assigned')}</th>
                  <th>{t('assign.note')}</th>
                </tr>
              </thead>
              <tbody>
                {board.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{shortName(item.nameEn, item.nameAm)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.unit}</div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{item.currentStock} {item.unit}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        className="input"
                        style={{ width: 130 }}
                        value={assignRows[item.id]?.quantity ?? ''}
                        placeholder="0"
                        onChange={(e) =>
                          setAssignRows((prev) => ({
                            ...prev,
                            [item.id]: { quantity: e.target.value, note: prev[item.id]?.note ?? '' },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        style={{ minWidth: 160 }}
                        value={assignRows[item.id]?.note ?? ''}
                        onChange={(e) =>
                          setAssignRows((prev) => ({
                            ...prev,
                            [item.id]: { quantity: prev[item.id]?.quantity ?? '', note: e.target.value },
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {assignMsg && <div style={{ marginTop: 'var(--space-3)', color: 'var(--success)', fontSize: 13 }}>{assignMsg}</div>}
        {assignError && <div style={{ marginTop: 'var(--space-3)', color: 'var(--danger)', fontSize: 13 }}>{assignError}</div>}
      </div>
    </div>
  );

  const renderSettlement = () => {
    const totals = settlement?.totals ?? { assigned: 0, expected: 0, assignedItems: 0, expectedItems: 0, orders: 0 };
    return (
      <div>
        {renderPeriodControls()}

        <div className="kpi-grid" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="stat-card">
            <div className="stat-card-label">{t('settlement.orders')}</div>
            <div className="stat-card-value">{totals.orders}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">{t('settlement.itemsAssigned')}</div>
            <div className="stat-card-value">{totals.assignedItems}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">{t('settlement.itemsUsed')}</div>
            <div className="stat-card-value">{totals.expectedItems}</div>
          </div>
        </div>

        <div className="glass-card-static panel" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div className="page-header" style={{ marginBottom: 'var(--space-3)' }}>
            <div>
              <div className="section-title">{t('tabs.settlement')}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>{t('settlement.intro')}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={loadingSettlement} onClick={loadSettlement}>
              {loadingSettlement ? t('common.loading') : t('settlement.refresh')}
            </button>
          </div>

          {loadingSettlement ? (
            <div className="text-muted">{t('common.loading')}</div>
          ) : !settlement || settlement.summary.length === 0 ? (
            <div className="text-muted">{t('settlement.noAssignment')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('assign.item')}</th>
                    <th>{t('settlement.totalAssigned')}</th>
                    <th>{t('settlement.totalExpected')}</th>
                    <th>{t('settlement.remaining')}</th>
                    <th>{t('settlement.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.summary.map((row) => {
                    const status = row.assigned === 0 && row.expected > 0
                      ? { label: t('settlement.unassigned'), cls: 'badge-warning' }
                      : row.remaining < 0
                        ? { label: t('settlement.over'), cls: 'badge-danger' }
                        : { label: t('settlement.ok'), cls: 'badge-success' };
                    return (
                      <tr key={row.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{shortName(row.nameEn, row.nameAm)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.unit}</div>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.assigned} {row.unit}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.expected} {row.unit}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: row.remaining < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                          {row.remaining} {row.unit}
                        </td>
                        <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-card-static panel" style={{ padding: 'var(--space-4)' }}>
          <div className="section-title" style={{ marginBottom: 'var(--space-3)' }}>{t('settlement.orders')}</div>

          {loadingSettlement ? (
            <div className="text-muted">{t('common.loading')}</div>
          ) : !settlement || settlement.orders.length === 0 ? (
            <div className="text-muted">{t('settlement.noOrders')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {settlement.orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-3)',
                    background: 'var(--bg-card)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700 }}>{order.orderNumber}</span>
                      <span className="badge badge-success">{order.status}</span>
                      <span className="badge badge-pending">{order.paymentStatus}</span>
                      {order.kitchenStatus && (
                        <span
                          className={`badge ${
                            order.kitchenStatus === 'READY'
                              ? 'badge-ready'
                              : order.kitchenStatus === 'SERVED' || order.kitchenStatus === 'CANCELLED'
                                ? 'badge-served'
                                : 'badge-preparing'
                          }`}
                        >
                          {t('settlement.kitchen')}: {order.kitchenStatus}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatDateTime(order.createdAt, locale)}
                      </span>
                      {order.staffName && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {order.staffName}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--space-2)' }}>
                    {order.items.map((item, idx) => (
                      <span key={`${order.id}-item-${idx}`} className="badge badge-preparing">
                        {item.quantity} × {shortName(item.nameEn, item.nameAm)}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {order.usage.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('recipes.noRecipe')}</span>
                    ) : (
                      order.usage.map((line) => (
                        <span
                          key={`${order.id}-usage-${line.inventoryItemId}`}
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'var(--accent-emerald-glow)',
                            color: 'var(--accent-emerald)',
                            fontWeight: 600,
                          }}
                        >
                          {line.quantity} {line.unit} {shortName(line.nameEn, line.nameAm)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {settlementError && <div style={{ marginTop: 'var(--space-3)', color: 'var(--danger)', fontSize: 13 }}>{settlementError}</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <div className="page-title">{t('title')}</div>
          <div className="text-muted" style={{ fontSize: 13 }}>{t('subtitle')}</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          padding: 4,
          marginBottom: 'var(--space-4)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-card)',
        }}
      >
        {(['recipes', 'assign', 'settlement'] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            className={`btn ${tab === value ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: '1 1 180px' }}
            onClick={() => setTab(value)}
          >
            {t(`tabs.${value}`)}
          </button>
        ))}
      </div>

      {tab === 'recipes' && renderRecipes()}
      {tab === 'assign' && renderAssign()}
      {tab === 'settlement' && renderSettlement()}
    </div>
  );
}
