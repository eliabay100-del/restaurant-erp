'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { updateScheduledPriceIncreases, type ScheduledPriceUpdate } from '@/features/menu/actions';
import { minutesToTime, parseTimeToMinutes } from '@/lib/scheduled-pricing';
import { formatPrice, getLocaleName } from '@/lib/utils';
import Icon from '@/components/shared/Icon';

export interface ScheduledVariant {
  id: number;
  nameEn: string;
  nameAm: string | null;
  priceOffset: number;
  scheduledIncrease: number;
  scheduledIncreaseStart: number;
  scheduledIncreaseEnd: number;
  scheduledIncreaseEnabled: boolean;
}

export interface ScheduledMenuItem {
  id: number;
  nameEn: string;
  nameAm: string | null;
  price: number;
  kind: string;
  categoryId: number;
  category: { nameEn: string; nameAm: string | null; color: string | null };
  variants: ScheduledVariant[];
  scheduledIncrease: number;
  scheduledIncreaseStart: number;
  scheduledIncreaseEnd: number;
  scheduledIncreaseEnabled: boolean;
}

interface ScheduledPriceEditorProps {
  items: ScheduledMenuItem[];
  onClose: () => void;
  onSaved: () => void;
}

type Draft = {
  amount: string;
  start: string;
  end: string;
  enabled: boolean;
};

type Row = {
  key: string;
  targetType: 'item' | 'variant';
  id: number;
  name: string;
  parentName?: string;
  parentKey?: string;
  categoryName: string;
  basePrice: number;
  amount: number;
  startMinute: number;
  endMinute: number;
  enabled: boolean;
};

function amountToSantim(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export default function ScheduledPriceEditor({ items, onClose, onSaved }: ScheduledPriceEditorProps) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkStart, setBulkStart] = useState('02:00');
  const [bulkEnd, setBulkEnd] = useState('06:00');
  const [bulkEnabled, setBulkEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    for (const item of items) {
      if (item.kind !== 'PRODUCT') continue;
      const itemName = getLocaleName(item.nameEn, item.nameAm, locale);
      const categoryName = getLocaleName(item.category.nameEn, item.category.nameAm, locale);
      const itemKey = `item:${item.id}`;

      result.push({
        key: itemKey,
        targetType: 'item',
        id: item.id,
        name: itemName,
        categoryName,
        basePrice: item.price,
        amount: item.scheduledIncrease,
        startMinute: item.scheduledIncreaseStart,
        endMinute: item.scheduledIncreaseEnd,
        enabled: item.scheduledIncreaseEnabled,
      });

      for (const variant of item.variants) {
        result.push({
          key: `variant:${variant.id}`,
          targetType: 'variant',
          id: variant.id,
          name: getLocaleName(variant.nameEn, variant.nameAm, locale),
          parentName: itemName,
          parentKey: itemKey,
          categoryName,
          basePrice: item.price + variant.priceOffset,
          amount: variant.scheduledIncrease,
          startMinute: variant.scheduledIncreaseStart,
          endMinute: variant.scheduledIncreaseEnd,
          enabled: variant.scheduledIncreaseEnabled,
        });
      }
    }
    return result;
  }, [items, locale]);

  const rowByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);

  const defaultDraft = (row: Row): Draft => ({
    amount: (row.amount / 100).toFixed(2),
    start: minutesToTime(row.startMinute),
    end: minutesToTime(row.endMinute),
    enabled: row.enabled,
  });

  const valueFor = (row: Row): Draft => edits[row.key] ?? defaultDraft(row);

  const updateRow = (row: Row, patch: Partial<Draft>) => {
    setEdits((prev) => ({
      ...prev,
      [row.key]: { ...(prev[row.key] ?? defaultDraft(row)), ...patch },
    }));
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.name, row.parentName, row.categoryName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.has(row.key));

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filteredRows.forEach((row) => next.delete(row.key));
      else filteredRows.forEach((row) => next.add(row.key));
      return next;
    });
  };

  const toggleRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyToSelected = () => {
    const targets = rows.filter((row) => selected.has(row.key));
    if (targets.length === 0) {
      setError(t('selectAtLeastOne'));
      return;
    }
    setError('');
    setEdits((prev) => {
      const next = { ...prev };
      for (const row of targets) {
        const current = next[row.key] ?? defaultDraft(row);
        next[row.key] = {
          ...current,
          ...(bulkAmount.trim() !== '' ? { amount: bulkAmount } : {}),
          start: bulkStart,
          end: bulkEnd,
          enabled: bulkEnabled,
        };
      }
      return next;
    });
  };

  const save = async () => {
    setError('');
    const payload: ScheduledPriceUpdate[] = [];

    for (const row of rows) {
      const draft = valueFor(row);
      const startMinute = parseTimeToMinutes(draft.start);
      const endMinute = parseTimeToMinutes(draft.end);
      const amountEtb = Number(draft.amount);

      if (startMinute === null || endMinute === null) {
        setError(t('invalidTime'));
        return;
      }
      if (startMinute === endMinute) {
        setError(t('timeWindowMustDiffer'));
        return;
      }
      if (!Number.isFinite(amountEtb) || amountEtb < 0) {
        setError(t('invalidIncrease'));
        return;
      }

      payload.push({
        targetType: row.targetType,
        id: row.id,
        amountEtb,
        startMinute,
        endMinute,
        enabled: draft.enabled,
      });
    }

    setSaving(true);
    const result = await updateScheduledPriceIncreases(payload);
    setSaving(false);

    if (result.success) {
      onSaved();
    } else {
      setError(result.error || t('saveFailed'));
    }
  };

  return (
    <div className="glass-card-static" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <div className="flex-between" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
        <div>
          <h4 style={{ marginBottom: 4 }}>{t('scheduledIncreases')}</h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            {t('scheduledIncreasesHint')}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>
          <Icon name="x" size={15} /> {tc('cancel')}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          alignItems: 'end',
          padding: 'var(--space-3)',
          marginTop: 'var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-card-hover)',
        }}
      >
        <div style={{ minWidth: 180, flex: '1 1 180px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            {t('searchItems')}
          </label>
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchItems')}
          />
        </div>
        <div style={{ width: 130 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            {t('increaseAmount')}
          </label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={bulkAmount}
            onChange={(event) => setBulkAmount(event.target.value)}
            placeholder="0.00"
          />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            {t('from')}
          </label>
          <input className="input" type="time" value={bulkStart} onChange={(event) => setBulkStart(event.target.value)} />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            {t('to')}
          </label>
          <input className="input" type="time" value={bulkEnd} onChange={(event) => setBulkEnd(event.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', paddingBottom: 10 }}>
          <input type="checkbox" checked={bulkEnabled} onChange={(event) => setBulkEnabled(event.target.checked)} />
          {t('active')}
        </label>
        <button className="btn btn-secondary btn-sm" type="button" onClick={applyToSelected}>
          {t('applyToSelected')}
        </button>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 'var(--space-2) 0' }}>
        {t('timeWindowHint')}
      </p>

      <div
        style={{
          maxHeight: 460,
          overflow: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '8px 10px', width: 36 }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label={t('selectItems')} />
              </th>
              <th style={{ padding: '8px 10px' }}>{t('items')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('basePrice')}</th>
              <th style={{ padding: '8px 10px', width: 110 }}>{t('increaseAmount')}</th>
              <th style={{ padding: '8px 10px', width: 110 }}>{t('from')}</th>
              <th style={{ padding: '8px 10px', width: 110 }}>{t('to')}</th>
              <th style={{ padding: '8px 10px', width: 60 }}>{t('active')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', width: 130 }}>{t('scheduledPrice')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const draft = valueFor(row);
              const parent = row.parentKey ? rowByKey.get(row.parentKey) : undefined;
              const parentDraft = parent ? valueFor(parent) : undefined;
              const parentIncrease = parentDraft?.enabled ? amountToSantim(parentDraft.amount) : 0;
              const ownIncrease = draft.enabled ? amountToSantim(draft.amount) : 0;
              const effective = row.basePrice + parentIncrease + ownIncrease;

              return (
                <tr key={row.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 10px' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.key)}
                      onChange={() => toggleRow(row.key)}
                      aria-label={row.name}
                    />
                  </td>
                  <td style={{ padding: '7px 10px', paddingLeft: row.targetType === 'variant' ? 28 : 10 }}>
                    <div style={{ fontWeight: row.targetType === 'item' ? 600 : 400 }}>
                      {row.targetType === 'variant' ? `${row.parentName} — ${row.name}` : row.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.categoryName}</div>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {formatPrice(row.basePrice, locale)}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.amount}
                      onChange={(event) => updateRow(row, { amount: event.target.value })}
                      style={{ padding: '5px 7px', fontSize: '0.8125rem' }}
                    />
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <input
                      className="input"
                      type="time"
                      value={draft.start}
                      onChange={(event) => updateRow(row, { start: event.target.value })}
                      style={{ padding: '5px 7px', fontSize: '0.8125rem' }}
                    />
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <input
                      className="input"
                      type="time"
                      value={draft.end}
                      onChange={(event) => updateRow(row, { end: event.target.value })}
                      style={{ padding: '5px 7px', fontSize: '0.8125rem' }}
                    />
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(event) => updateRow(row, { enabled: event.target.checked })}
                      aria-label={t('active')}
                    />
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      fontWeight: 700,
                      color: effective !== row.basePrice ? 'var(--accent-emerald)' : 'var(--text-muted)',
                    }}
                  >
                    {formatPrice(effective, locale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {t('noScheduledItems')}
          </div>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '0.8125rem', marginTop: 'var(--space-2)' }}>{error}</div>}

      <div className="flex-between" style={{ marginTop: 'var(--space-3)', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {selected.size} {t('selected')}
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            {tc('cancel')}
          </button>
          <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('saveIncreases')}
          </button>
        </div>
      </div>
    </div>
  );
}
