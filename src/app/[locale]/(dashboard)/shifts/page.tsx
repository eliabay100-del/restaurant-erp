'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getShiftReports } from '@/features/dashboard/actions';
import { approveShift, rejectShift } from '@/features/auth/actions';
import { useAuth } from '@/context/AuthProvider';
import { formatPrice, formatDateTime, getLocaleName } from '@/lib/utils';
import Icon from '@/components/shared/Icon';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';

interface ShiftData {
  id: number;
  staffName: string;
  staffNameAm: string | null;
  startTime: string;
  endTime: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  status: string;
  totalSales: number;
  orderCount: number;
  cashSales: number;
}

export default function ShiftsPage() {
  const t = useTranslations('shift');
  const ts = useTranslations('staff');
  const locale = useLocale();
  const { staff } = useAuth();
  const [shifts, setShifts] = useState<ShiftData[]>([]);

  const loadShifts = async () => {
    const result = await getShiftReports();
    if (result.success) setShifts(result.shifts as ShiftData[]);
  };

  useAsyncEffect(loadShifts, []);

  const handleApprove = async (shiftId: number) => {
    if (!staff) return;
    await approveShift(shiftId, staff.id);
    loadShifts();
  };

  const handleReject = async (shiftId: number) => {
    if (!staff) return;
    await rejectShift(shiftId, staff.id);
    loadShifts();
  };

  const isManager = staff?.role === 'MANAGER' || staff?.role === 'ADMIN';

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="page-title">{ts('shiftReports')}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {shifts.map((shift) => {
          const diffColor = shift.difference === null ? 'var(--text-muted)'
            : shift.difference > 0 ? 'var(--success)'
            : shift.difference < 0 ? 'var(--danger)'
            : 'var(--accent-emerald)';

          const statusBadge = shift.status === 'OPEN' ? 'badge-preparing'
            : shift.status === 'PENDING_APPROVAL' ? 'badge-pending'
            : shift.status === 'APPROVED' ? 'badge-ready'
            : shift.status === 'REJECTED' ? 'badge-cancelled'
            : 'badge-served';

          return (
            <div key={shift.id} className="glass-card-static panel">
              <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="user" size={16} /> {getLocaleName(shift.staffName, shift.staffNameAm, locale)}
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                    {formatDateTime(shift.startTime, locale)}
                    {shift.endTime && ` → ${formatDateTime(shift.endTime, locale)}`}
                  </p>
                </div>
                <span className={`badge ${statusBadge}`}>{shift.status.replace('_', ' ')}</span>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('totalOrders')}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{shift.orderCount}</div>
                </div>
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('totalSales')}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{formatPrice(shift.totalSales, locale)}</div>
                </div>
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('openingCash')}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatPrice(shift.openingCash, locale)}</div>
                </div>
                {shift.closingCash !== null && (
                  <>
                    <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('expectedCash')}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatPrice(shift.expectedCash || 0, locale)}</div>
                    </div>
                    <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('countedCash')}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatPrice(shift.closingCash, locale)}</div>
                    </div>
                    <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${diffColor}` }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('difference')}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: diffColor }}>
                        {shift.difference !== null ? (shift.difference > 0 ? '+' : '') + formatPrice(shift.difference, locale) : '—'}
                      </div>
                      {shift.difference !== null && (
                        <div style={{ fontSize: '0.6875rem', color: diffColor }}>
                          {shift.difference > 0 ? t('overage') : shift.difference < 0 ? t('shortage') : t('balanced')}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Approval buttons */}
              {shift.status === 'PENDING_APPROVAL' && isManager && (
                <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-primary" onClick={() => handleApprove(shift.id)}>
                    <Icon name="check" size={16} /> {t('approve')}
                  </button>
                  <button className="btn btn-danger" onClick={() => handleReject(shift.id)}>
                    <Icon name="x" size={16} /> {t('reject')}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {shifts.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="coins" size={48} /></div>
            <div className="empty-state-title">No shifts recorded yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
