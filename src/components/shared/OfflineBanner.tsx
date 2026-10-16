'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Icon from '@/components/shared/Icon';

/**
 * Shows a persistent notice when the browser reports it is offline.
 * Data writes still queue in the UI and will fail loudly — this simply makes
 * the loss of connectivity visible instead of mysterious action errors.
 */
export default function OfflineBanner() {
  const tc = useTranslations('common');
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 'var(--z-toast)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        padding: '8px var(--space-4)',
        background: 'var(--warning)',
        color: '#fff',
        fontSize: '0.875rem',
        fontWeight: 600,
      }}
    >
      <Icon name="wifiOff" size={16} />
      <span>Offline</span>
      <span style={{ fontWeight: 400, opacity: 0.9 }}>{tc('offline')}</span>
    </div>
  );
}
