'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthProvider';
import { useSocket } from '@/context/SocketProvider';
import { useRouter } from '@/i18n/routing';
import LanguageToggle from '@/components/shared/LanguageToggle';
import OfflineBanner from '@/components/shared/OfflineBanner';
import Icon from '@/components/shared/Icon';
import EndShiftModal from '@/features/auth/components/EndShiftModal';
import Link from 'next/link';

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  const tn = useTranslations('nav');
  const ts = useTranslations('shift');
  const { staff, shift, logout } = useAuth();
  const { isConnected } = useSocket();
  const router = useRouter();
  const [showEndShift, setShowEndShift] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isManager = staff?.role === 'MANAGER' || staff?.role === 'ADMIN';
  const isWaiter = staff?.role === 'WAITER';

  return (
    <div className="pos-view">
      <OfflineBanner />
      <header className="app-header">
        <div className="app-logo">
          <img src="/logo.png" alt="Mesob" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.25rem' }}>{t('appName')}</span>
        </div>

        <div className="header-actions">
          {/* Connection status */}
          <div className="connection-status">
            <div className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          </div>

          {/* Staff info */}
          {staff && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-3)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <Icon name="user" size={16} /> {staff.name}
              </span>
            </div>
          )}

          {/* Back to Dashboard (for managers) */}
          {isManager && (
            <Link href="/overview" style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary btn-sm"><Icon name="dashboard" size={16} /> {tn('backToDashboard')}</button>
            </Link>
          )}

          {/* End Shift button (for cashiers with active shift) */}
          {shift && !isWaiter && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEndShift(true)} style={{ borderColor: 'var(--warning)' }}>
              <Icon name="stop" size={16} /> {ts('endShift')}
            </button>
          )}

          <LanguageToggle />

          <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Logout" aria-label="Logout">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>
      {children}

      {/* End Shift Modal */}
      {showEndShift && shift && (
        <EndShiftModal
          shiftId={shift.id}
          onClose={() => setShowEndShift(false)}
          onComplete={() => {
            setShowEndShift(false);
            router.push('/login');
          }}
        />
      )}
    </div>
  );
}
