'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/context/AuthProvider';
import { verifyPin, getActiveShift, startShift } from '@/features/auth/actions';
import PinPad from '@/features/auth/components/PinPad';
import ShiftStartModal from '@/features/auth/components/ShiftStartModal';
import LanguageToggle from '@/components/shared/LanguageToggle';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const { setStaff, setShift } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);

  const handlePinSubmit = async (pin: string) => {
    setError('');
    setLoading(true);

    const result = await verifyPin(pin);

    if (result.success && result.staff) {
      setStaff(result.staff);

      // Route based on role
      if (result.staff.role === 'KITCHEN') {
        router.push('/kitchen');
      } else if (result.staff.role === 'CASHIER') {
        // Check if there's an existing open shift — resume it silently
        const existingShift = await getActiveShift(result.staff.id);
        if (existingShift) {
          // Resume: set the shift cookie and go directly to cashier
          await startShift(result.staff.id, existingShift.openingCash);
          setShift(existingShift);
          router.push('/cashier');
        } else {
          // No open shift — show the shift start modal
          setShowShiftModal(true);
        }
      } else if (result.staff.role === 'WAITER') {
        // Waiters don't have shifts (or they do, but without cash).
        // For now, let's just create a 0-cash shift silently if they need one, or just route them.
        // Orders require a shiftId, so let's start a zero-cash shift for them automatically.
        const existingShift = await getActiveShift(result.staff.id);
        if (existingShift) {
          setShift(existingShift);
        } else {
          const shiftRes = await startShift(result.staff.id, 0);
          if (shiftRes.success && shiftRes.shift) {
            setShift(shiftRes.shift);
          }
        }
        router.push('/waiter');
      } else {
        // Manager/Admin — also check for open shift
        const existingShift = await getActiveShift(result.staff.id);
        if (existingShift) {
          setShift(existingShift);
        }
        router.push('/overview');
      }
    } else {
      setError(t('invalidPin'));
    }
    setLoading(false);
  };

  if (showShiftModal) {
    return <ShiftStartModal onClose={() => setShowShiftModal(false)} />;
  }

  return (
    <div className="pin-pad-container">
      {/* Language toggle */}
      <div style={{ position: 'absolute', top: 'var(--space-5)', right: 'var(--space-5)' }}>
        <LanguageToggle />
      </div>

      <div className="pin-pad-card glass-card-static">
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{
            width: 80,
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-4)',
          }}>
            <img src="/logo.png" alt="Mesob" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
            {tc('appName')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.04em', margin: 0 }}>
            by{' '}
            <a
              href="https://amba.site.je"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              Amba Solutions
            </a>
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 'var(--space-2)' }}>
            {tc('tagline')}
          </p>
        </div>

        {/* PIN entry label */}
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.9375rem' }}>
          {t('enterPin')}
        </p>

        {/* PIN Pad */}
        <PinPad
          onSubmit={handlePinSubmit}
          error={error}
          loading={loading}
        />

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
            <div className="loading-spinner" />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('loggingIn')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
