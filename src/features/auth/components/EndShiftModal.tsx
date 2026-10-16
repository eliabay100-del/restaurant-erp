'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { endShift } from '@/features/auth/actions';
import { useAuth } from '@/context/AuthProvider';
import { useSocketEmit } from '@/hooks/useSocketEvent';
import { formatPrice } from '@/lib/utils';
import Icon from '@/components/shared/Icon';

interface EndShiftModalProps {
  shiftId: number;
  onClose: () => void;
  onComplete: () => void;
}

export default function EndShiftModal({ shiftId, onClose, onComplete }: EndShiftModalProps) {
  const t = useTranslations('shift');
  const tc = useTranslations('common');
  const { setShift, logout } = useAuth();
  const emit = useSocketEmit();
  const [amount, setAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    openingCash: number; closingCash: number | null; expectedCash: number | null;
    difference: number; totalSales: number; orderCount: number;
  } | null>(null);

  const handleKey = (key: string) => {
    if (key === 'backspace') {
      setAmount((a) => (a.length <= 1 ? '0' : a.slice(0, -1)));
    } else if (key === '.') {
      if (!amount.includes('.')) setAmount((a) => a + '.');
    } else if (key === 'clear') {
      setAmount('0');
    } else {
      setAmount((a) => (a === '0' ? key : a + key));
    }
  };

  const handleEndShift = async () => {
    setLoading(true);
    const res = await endShift(shiftId, parseFloat(amount) || 0, notes || undefined);
    if (res.success && res.shift) {
      setResult({
        openingCash: res.shift.openingCash,
        closingCash: res.shift.closingCash,
        expectedCash: res.shift.expectedCash,
        difference: res.shift.difference,
        totalSales: res.shift.totalSales,
        orderCount: res.shift.orderCount,
      });
      emit('shift:ended', { shiftId, staffName: 'Staff' });
      setShift(null);
    }
    setLoading(false);
  };

  const handleDone = () => {
    logout();
    onComplete();
  };

  const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

  // Show summary after successful end
  if (result) {
    const diffColor = result.difference > 0 ? 'var(--success)' : result.difference < 0 ? 'var(--danger)' : 'var(--accent-emerald)';
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '460px' }}>
          <div className="modal-header">
            <h2>{t('shiftSummary')}</h2>
          </div>
          <div className="modal-body" style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--success)', marginBottom: 'var(--space-4)' }}><Icon name="checkCircle" size={48} /></div>
            <h3 style={{ marginBottom: 'var(--space-6)' }}>{t('shiftEnded')}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', textAlign: 'left' }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('totalOrders')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.orderCount}</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('totalSales')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{formatPrice(result.totalSales)}</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('expectedCash')}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatPrice(result.expectedCash || 0)}</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('countedCash')}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatPrice(result.closingCash || 0)}</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', gridColumn: '1 / -1', borderLeft: `3px solid ${diffColor}` }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('difference')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: diffColor }}>
                  {result.difference > 0 ? '+' : ''}{formatPrice(result.difference)}
                </div>
                <div style={{ fontSize: '0.75rem', color: diffColor }}>
                  {result.difference > 0 ? t('overage') : result.difference < 0 ? t('shortage') : t('balanced')}
                </div>
              </div>
            </div>

            <p style={{ marginTop: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {t('pendingApproval')}
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary btn-lg w-full" onClick={handleDone}>
              <Icon name="check" size={18} /> {tc('ok')} — {tc('back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="stop" size={20} /> {t('endShift')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc('close')}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            {t('enterClosingCash')}
          </p>

          {/* Amount display */}
          <div style={{
            fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-gold)',
            marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
            background: 'var(--bg-input)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}>
            {parseFloat(amount).toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{tc('currency')}</span>
          </div>

          {/* Numpad */}
          <div className="numpad" style={{ maxWidth: '280px', margin: '0 auto', marginBottom: 'var(--space-4)' }}>
            {numKeys.map((key) => (
              <button key={key} className="numpad-key" onClick={() => handleKey(key)}>
                {key === 'backspace' ? <Icon name="backspace" size={20} /> : key}
              </button>
            ))}
          </div>

          {/* Notes */}
          <textarea
            className="input"
            placeholder={t('addNotes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: 'vertical', minHeight: '60px', width: '100%' }}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{tc('cancel')}</button>
          <button className="btn btn-primary btn-lg" onClick={handleEndShift} disabled={loading} style={{ flex: 1 }}>
            {loading ? tc('loading') : (<><Icon name="stop" size={18} /> {t('endShift')}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
