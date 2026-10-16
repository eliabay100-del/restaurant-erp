'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { useAuth } from '@/context/AuthProvider';
import { useSocket } from '@/context/SocketProvider';
import { useRouter } from '@/i18n/routing';
import { canAccessPath, canAccessPos } from '@/lib/roles';
import LanguageToggle from '@/components/shared/LanguageToggle';
import OfflineBanner from '@/components/shared/OfflineBanner';
import Icon, { type IconName } from '@/components/shared/Icon';
import Link from 'next/link';

type NavKey = 'overview' | 'orders' | 'menu' | 'shifts' | 'employees' | 'inventory' | 'reports' | 'integrations';

const navItems: { path: string; icon: IconName; labelKey: NavKey }[] = [
  { path: '/overview', icon: 'dashboard', labelKey: 'overview' },
  { path: '/orders', icon: 'orders', labelKey: 'orders' },
  { path: '/menu', icon: 'menu', labelKey: 'menu' },
  { path: '/shifts', icon: 'shifts', labelKey: 'shifts' },
  { path: '/employees', icon: 'employees', labelKey: 'employees' },
  { path: '/inventory', icon: 'inventory', labelKey: 'inventory' },
  { path: '/reports', icon: 'reports', labelKey: 'reports' },
  { path: '/settings/integrations', icon: 'folder', labelKey: 'integrations' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const td = useTranslations('dashboard');
  const { staff, isReady, logout } = useAuth();
  const { isConnected } = useSocket();
  const pathname = usePathname();
  const router = useRouter();

  // Not signed in → send to the login screen.
  useEffect(() => {
    if (isReady && !staff) router.replace('/login');
  }, [isReady, staff, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const visibleNav = navItems.filter((item) => canAccessPath(staff?.role, item.path));
  const allowed = staff ? canAccessPath(staff.role, pathname) : false;

  const shell = (content: React.ReactNode) => (
    <div className="pos-view">
      <OfflineBanner />
      <header className="app-header">
        <div className="app-logo">
          <img src="/logo.png" alt="Mesob" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.25rem' }}>{tc('appName')}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'var(--space-2)' }}>
            {td('dashboard')}
          </span>
        </div>
        <div className="header-actions">
          <div className="connection-status">
            <div className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          </div>
          {staff && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <Icon name="user" size={16} /> {staff.name}
            </span>
          )}
          {canAccessPos(staff?.role, 'cashier') && (
            <Link href="/cashier" style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary btn-sm"><Icon name="cashier" size={16} /> {t('cashier')}</button>
            </Link>
          )}
          {canAccessPos(staff?.role, 'kitchen') && (
            <Link href="/kitchen" style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary btn-sm"><Icon name="kitchen" size={16} /> {t('kitchen')}</button>
            </Link>
          )}
          <LanguageToggle />
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} aria-label={tc('logout')}><Icon name="logout" size={18} /></button>
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - var(--header-height) - var(--footer-height))' }}>
        {/* Sidebar */}
        <nav className="sidebar">
          {visibleNav.map((item) => (
            <Link key={item.path} href={item.path} style={{ textDecoration: 'none' }}>
              <div className={`sidebar-item ${pathname === item.path ? 'active' : ''}`}>
                <span className="icon"><Icon name={item.icon} size={20} /></span>
                <span>{t(item.labelKey)}</span>
              </div>
            </Link>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>
          {content}
        </main>
      </div>
    </div>
  );

  // Session is still being restored — render the shell without content to avoid a flash.
  if (!isReady) return shell(null);

  if (!staff) {
    return (
      <div className="empty-state" style={{ minHeight: 'calc(100vh - var(--footer-height))' }}>
        <div className="empty-state-icon"><Icon name="lock" size={48} /></div>
        <div className="empty-state-title">{tc('goToLogin')}</div>
      </div>
    );
  }

  if (!allowed) {
    return shell(
      <div className="empty-state" style={{ minHeight: '40vh' }}>
        <div className="empty-state-icon"><Icon name="lock" size={48} /></div>
        <div className="empty-state-title">{tc('notAuthorized')}</div>
        <div className="empty-state-desc">{tc('notAuthorizedDesc')}</div>
      </div>
    );
  }

  return shell(children);
}
