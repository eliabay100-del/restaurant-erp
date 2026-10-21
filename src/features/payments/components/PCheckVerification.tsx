'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { formatPrice } from '@/lib/utils';
import Icon from '@/components/shared/Icon';

interface PCheckVerificationProps {
  orderId: number;
  orderNumber: string;
  tableNumber: string | null;
  amount: number;
  onSuccess: (transactionId: string) => void;
  onCancel: () => void;
}

export default function PCheckVerification({
  orderId,
  orderNumber,
  tableNumber,
  amount,
  onSuccess,
  onCancel,
}: PCheckVerificationProps) {
  const locale = useLocale();
  const [status, setStatus] = useState<'sending' | 'waiting' | 'verified' | 'declined'>('sending');

  useEffect(() => {
    // Send verification request to P-Check
    async function sendRequest() {
      try {
        const res = await fetch('/api/pcheck/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            orderNumber,
            tableNumber,
            amount,
          }),
        });

        if (!res.ok) throw new Error('Failed to send request');
        
        setStatus('waiting');
      } catch (error) {
        console.error('Failed to send P-Check request:', error);
        setStatus('declined');
      }
    }

    sendRequest();
  }, [orderId, orderNumber, tableNumber, amount]);

  useEffect(() => {
    if (status !== 'waiting') return;

    // Poll for verification result
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${orderId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.verificationStatus === 'VERIFIED') {
            setStatus('verified');
            clearInterval(interval);
            setTimeout(() => onSuccess(data.reference || ''), 1500);
          } else if (data.verificationStatus === 'DECLINED') {
            setStatus('declined');
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Failed to check status:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, orderId, onSuccess]);

  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      {status === 'sending' && (
        <>
          <div style={{
            width: 60,
            height: 60,
            margin: '0 auto 20px',
            border: '4px solid var(--border)',
            borderTopColor: 'var(--accent-gold)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Sending to P-Check...
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {tableNumber ? `Table ${tableNumber}` : orderNumber} • {formatPrice(amount, locale)}
          </div>
        </>
      )}

      {status === 'waiting' && (
        <>
          <div style={{
            width: 80,
            height: 80,
            margin: '0 auto 24px',
            borderRadius: '50%',
            background: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon name="smartphone" size={40} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Waiting for Verification
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Check your P-Check app to complete verification
          </div>
          <div style={{
            padding: 16,
            background: 'var(--bg-card)',
            borderRadius: 12,
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
              Amount
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-gold)' }}>
              {formatPrice(amount, locale)}
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#3b82f6',
              animation: 'pulse 2s infinite',
            }} />
            Waiting for P-Check response...
          </div>
          <button
            onClick={onCancel}
            style={{
              marginTop: 24,
              padding: '10px 20px',
              border: '1px solid var(--border)',
              background: 'transparent',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
        </>
      )}

      {status === 'verified' && (
        <div style={{ padding: 20 }}>
          <div style={{
            width: 80,
            height: 80,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon name="check" size={48} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>
            Payment Verified!
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Confirmed by P-Check
          </div>
        </div>
      )}

      {status === 'declined' && (
        <div style={{ padding: 20 }}>
          <div style={{
            width: 80,
            height: 80,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon name="x" size={48} style={{ color: '#dc2626' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>
            Verification Failed
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Payment could not be verified
          </div>
          <button onClick={onCancel} className="btn btn-primary">
            Try Again
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
