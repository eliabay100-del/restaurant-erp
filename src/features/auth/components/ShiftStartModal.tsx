'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { startShift } from '@/features/auth/actions';
import { useAuth } from '@/context/AuthProvider';
import { useRouter } from '@/i18n/routing';
import Icon from '@/components/shared/Icon';

interface ShiftStartModalProps {
  onClose: () => void;
}

export default function ShiftStartModal({ onClose }: ShiftStartModalProps) {
  const t = useTranslations('shift');
  const tc = useTranslations('common');
  const { staff, setShift } = useAuth();
  const router = useRouter();
  const [amount, setAmount] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleKey = (key: string) => {
    setError('');
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

  const handleStart = async () => {
    if (!staff) return;
    setLoading(true);
    setError('');
    const result = await startShift(staff.id, parseFloat(amount) || 0);
    if (result.success && result.shift) {
      setShift(result.shift);
      router.push('/cashier');
    } else if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2>{t('startShift')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc('close')}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          {error && (
            <div style={{ color: 'var(--danger)', background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: 'var(--space-2)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
              <Icon name="alertTriangle" size={16} /> {error}
            </div>
          )}
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            {t('enterOpeningCash')}
          </p>

          {/* Amount display */}
          <div style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: 'var(--accent-gold)',
            marginBottom: 'var(--space-6)',
            padding: 'var(--space-4)',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}>
            {parseFloat(amount).toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{tc('currency')}</span>
          </div>

          {/* Numpad */}
          <div className="numpad" style={{ maxWidth: '280px', margin: '0 auto' }}>
            {numKeys.map((key) => (
              <button
                key={key}
                className="numpad-key"
                onClick={() => handleKey(key)}
              >
                {key === 'backspace' ? <Icon name="backspace" size={20} /> : key}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{tc('cancel')}</button>
          <button className="btn btn-primary btn-lg" onClick={handleStart} disabled={loading} style={{ flex: 1 }}>
            {loading ? tc('loading') : t('startShift')}
          </button>
        </div>
      </div>
    </div>
  );
}
