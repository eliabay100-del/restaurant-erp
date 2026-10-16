'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/utils';
import { processPayment } from '@/features/payments/actions';
import { ReceiptData, ReceiptModal } from '@/components/shared/Receipt';
import Icon from '@/components/shared/Icon';

interface PaymentModalProps {
  orderId: number;
  total: number;
  onComplete: (payment: { method: string; amountPaid: number; change: number }) => void;
  onClose: () => void;
}

export default function PaymentModal({ orderId, total, onComplete, onClose }: PaymentModalProps) {
  const t = useTranslations('payment');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [method, setMethod] = useState<string>('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const amountNum = parseFloat(amount) || 0;
  const change = method === 'CASH' ? Math.max(0, amountNum - total) : 0;
  const canPay = method === 'CASH' ? amountNum >= total : reference.length > 0;

  const handleKey = (key: string) => {
    if (key === 'backspace') {
      setAmount((a) => a.slice(0, -1));
    } else if (key === '.') {
      if (!amount.includes('.')) setAmount((a) => a + '.');
    } else if (key === 'clear') {
      setAmount('');
    } else {
      setAmount((a) => a + key);
    }
  };

  const handleQuickAmount = (value: number) => {
    setAmount(String(value));
  };

  const handlePay = async () => {
    setLoading(true);
    const paid = method === 'CASH' ? amountNum : total;
    const result = await processPayment(orderId, method, paid, reference || undefined);

    if (result.success) {
      const o = result.order;
      const p = result.payment;
      setReceipt({
        orderNumber: o.orderNumber,
        type: o.type,
        tableNumber: o.tableNumber,
        subtotal: o.subtotal,
        discount: o.discount,
        taxAmount: o.taxAmount,
        total: o.total,
        note: o.note,
        createdAt: o.createdAt.toISOString(),
        staffName: o.staff?.name ?? '',
        staffNameAm: o.staff?.nameAm ?? null,
        lines: (o.items ?? []).map((i) => ({
          nameEn: i.itemNameEn ?? '',
          nameAm: i.itemNameAm ?? null,
          qty: i.quantity,
          unitPrice: i.unitPrice,
          total: i.totalPrice,
          note: i.note,
        })),
        payment: {
          method: p.method,
          amountPaid: p.amountPaid,
          amountDue: p.amountDue,
          changeGiven: p.changeGiven,
          reference: p.reference ?? null,
        },
      });
      onComplete({ method, amountPaid: paid, change: method === 'CASH' ? Math.max(0, paid - total) : 0 });
    }
    setLoading(false);
  };

  const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];
  const roundUp = Math.ceil(total / 10) * 10;

  if (receipt) {
    return <ReceiptModal data={receipt} onClose={onClose} />;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>{t('processPayment')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc('close')}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          {/* Amount Due */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>{t('amountDue')}</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{formatPrice(total, locale)}</div>
          </div>

          {/* Payment method */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
            {['CASH', 'CARD', 'MOBILE'].map((m) => (
              <button
                key={m}
                className={`btn ${method === m ? 'btn-primary' : 'btn-secondary'} btn-lg`}
                onClick={() => setMethod(m)}
                style={{ flex: 1 }}
              >
                {m === 'CASH' ? <Icon name="banknote" size={18} /> : m === 'CARD' ? <Icon name="creditCard" size={18} /> : <Icon name="smartphone" size={18} />}{' '}
                {m === 'CASH' ? t('amountPaid').split(' ')[0] : m === 'CARD' ? 'Card' : 'Mobile'}
              </button>
            ))}
          </div>

          {method === 'CASH' && (
            <>
              {/* Amount display */}
              <div style={{
                fontSize: '2rem', fontWeight: 700, textAlign: 'center', padding: 'var(--space-3)',
                background: 'var(--bg-input)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                marginBottom: 'var(--space-3)', color: amountNum >= total ? 'var(--success)' : 'var(--text-primary)',
              }}>
                {amount || '0'} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{tc('currency')}</span>
              </div>

              {/* Quick amounts */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleQuickAmount(total)} style={{ flex: 1 }}>{t('exactAmount')}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleQuickAmount(roundUp)} style={{ flex: 1 }}>{formatPrice(roundUp, locale)}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleQuickAmount(roundUp + 50)} style={{ flex: 1 }}>{formatPrice(roundUp + 50, locale)}</button>
              </div>

              {/* Numpad */}
              <div className="numpad" style={{ maxWidth: '100%' }}>
                {numKeys.map((key) => (
                  <button key={key} className="numpad-key" onClick={() => handleKey(key)}>
                    {key === 'backspace' ? <Icon name="backspace" size={20} /> : key}
                  </button>
                ))}
              </div>

              {/* Change display */}
              {amountNum > 0 && (
                <div style={{
                  marginTop: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)',
                  background: change > 0 ? 'var(--success-glow)' : 'var(--danger-glow)', textAlign: 'center',
                }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('change')}: </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: change > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatPrice(change, locale)}
                  </span>
                </div>
              )}
            </>
          )}

          {(method === 'CARD' || method === 'MOBILE') && (
            <input
              className="input input-lg"
              placeholder={t('reference')}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              autoFocus
            />
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{tc('cancel')}</button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handlePay}
            disabled={!canPay || loading}
            style={{ flex: 1 }}
          >
            {loading ? tc('loading') : (<><Icon name="check" size={18} /> {t('paymentComplete')}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
