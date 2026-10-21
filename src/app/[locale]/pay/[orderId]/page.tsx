'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { formatPrice } from '@/lib/utils';

export default function PaymentRequestPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const orderId = parseInt(params.orderId as string);
  const amount = parseFloat(searchParams.get('amount') || '0');

  useEffect(() => {
    async function loadOrder() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) throw new Error('Order not found');
        const data = await res.json();
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [orderId]);

  const handleVerify = async () => {
    // This will redirect to P-Check with payment details
    // P-Check will verify and redirect back with result
    const pcheckUrl = process.env.NEXT_PUBLIC_PCHECK_URL || 'http://localhost:8000';
    const callbackUrl = `${window.location.origin}/api/payments/${orderId}/callback`;
    
    window.location.href = `${pcheckUrl}/verify?order=${orderId}&amount=${amount}&callback=${encodeURIComponent(callbackUrl)}`;
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div>Loading payment details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#dc2626' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Payment Request
        </h1>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {order?.tableNumber ? `Table ${order.tableNumber}` : `Order ${order?.orderNumber}`}
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Amount to pay
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--accent-gold)' }}>
          {formatPrice(amount, locale)}
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Order Details
        </div>
        {order?.items?.map((item: any, i: number) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0',
            fontSize: 14,
            borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span>{item.quantity}× {item.itemNameEn}</span>
            <span>{formatPrice(item.totalPrice, locale)}</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleVerify}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 10,
          border: 'none',
          background: '#010103',
          color: '#fff',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Verify with P-Check
      </button>

      <div style={{
        marginTop: 20,
        padding: 16,
        background: '#ecfdf5',
        borderRadius: 8,
        fontSize: 13,
        color: '#166534',
        textAlign: 'center',
      }}>
        This will open P-Check to verify your payment
      </div>
    </div>
  );
}
