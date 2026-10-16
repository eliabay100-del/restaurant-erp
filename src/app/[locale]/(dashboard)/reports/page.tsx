'use client';

import { useState, useCallback, useRef } from 'react';
import { useLocale } from 'next-intl';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import { formatPrice } from '@/lib/utils';
import { getDailyReport, getWeeklyReport, getMonthlyReport } from '@/features/reports/actions';
import { ComprehensiveReportExport, type ReportData } from '@/components/reports/ComprehensiveReportExport';
import Icon, { type IconName } from '@/components/shared/Icon';

import html2canvas from 'html2canvas';

type Period = 'daily' | 'weekly' | 'monthly';

/** One aggregated menu item as returned by the report actions. */
interface ReportTopItem {
  nameEn: string;
  qty: number;
  revenue: number;
}

/** Payload of `getDailyReport`. */
interface DailyReportData {
  totalRevenue: number;
  totalOrders: number;
  cashRevenue: number;
  cardRevenue: number;
  mobileRevenue: number;
  avgOrderValue: number;
  topItems: ReportTopItem[];
  hourlyRevenue: Record<number, number>;
}

/** Payload of `getWeeklyReport`. */
interface WeeklyReportData {
  totalRevenue: number;
  totalOrders: number;
  cashRevenue: number;
  cardRevenue: number;
  mobileRevenue: number;
  avgOrderValue: number;
  avgDailyRevenue: number;
  dailyRevenue: Record<string, number>;
  topItems: ReportTopItem[];
}

/** Payload of `getMonthlyReport`. */
interface MonthlyReportData {
  month: string;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  mobileRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  topItems: ReportTopItem[];
}

/**
 * Any of the three report payloads, for the CSV exporter. A few fields are
 * period-specific (e.g. `hourlyRevenue` only exists on the daily payload), so
 * they are optional here and every read is defaulted.
 */
interface ReportExportData {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue?: number;
  cashRevenue?: number;
  cardRevenue?: number;
  mobileRevenue?: number;
  hourlyRevenue?: Record<number, number>;
  dailyRevenue?: Record<string, number>;
  topItems?: ReportTopItem[];
}

interface StatCardProps {
  icon: IconName;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 'var(--radius)',
      padding: 'var(--space-4)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-1)'
    }}>
      <div style={{ color: 'var(--accent-emerald)' }}><Icon name={icon} size={24} /></div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function ReportsPage() {
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyData, setDailyData] = useState<DailyReportData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyReportData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingImg, setExportingImg] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    if (period === 'daily') {
      const r = await getDailyReport(selectedDate);
      if (r.success) setDailyData(r as DailyReportData);
    } else if (period === 'weekly') {
      const r = await getWeeklyReport();
      if (r.success) setWeeklyData(r as WeeklyReportData);
    } else {
      const r = await getMonthlyReport();
      if (r.success) setMonthlyData(r as MonthlyReportData);
    }
    setLoading(false);
  }, [period, selectedDate]);

  useAsyncEffect(loadReport, [loadReport]);

  const fp = (n: number) => formatPrice(n, locale);

  const handleExportImage = async () => {
    const el = exportRef.current;
    if (!el) return;
    setExportingImg(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2, // Higher resolution
        backgroundColor: '#ffffff', // Explicit white background for the comprehensive export
        onclone: (document) => {
          // ensure the cloned element is visible so html2canvas can draw it
          const clonedEl = document.getElementById('comprehensive-export-wrapper');
          if (clonedEl) {
            clonedEl.style.position = 'relative';
            clonedEl.style.top = '0';
            clonedEl.style.left = '0';
            clonedEl.style.zIndex = '1';
            clonedEl.style.display = 'block';
          }
        }
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const title = period === 'daily' ? `Daily_Report_${selectedDate}` : 
                  period === 'weekly' ? `Weekly_Report_${new Date().toISOString().slice(0, 10)}` : 
                  `Monthly_Report_${new Date().toISOString().slice(0, 7)}`;
      link.download = `${title}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
    }
    setExportingImg(false);
  };

  const handleExport = () => {
    let data: ReportExportData | null = null;
    let title = '';
    
    if (period === 'daily' && dailyData) {
      data = dailyData;
      title = `Daily_Report_${selectedDate}`;
    } else if (period === 'weekly' && weeklyData) {
      data = weeklyData;
      title = `Weekly_Report_${new Date().toISOString().slice(0, 10)}`;
    } else if (period === 'monthly' && monthlyData) {
      data = monthlyData;
      title = `Monthly_Report_${new Date().toISOString().slice(0, 7)}`;
    }

    if (!data) return;

    // Generate CSV content
    const lines = [];
    
    lines.push('--- SUMMARY ---');
    lines.push(`Period,${period.toUpperCase()}`);
    lines.push(`Total Revenue,${data.totalRevenue}`);
    lines.push(`Total Orders,${data.totalOrders}`);
    lines.push(`Avg Order Value,${data.avgOrderValue ?? 0}`);
    lines.push(`Cash Revenue,${data.cashRevenue ?? 0}`);
    lines.push(`Card Revenue,${data.cardRevenue ?? 0}`);
    lines.push(`Mobile Revenue,${data.mobileRevenue ?? 0}`);
    
    lines.push('');
    lines.push('--- TOP SELLING ITEMS ---');
    lines.push('Item Name,Quantity Sold,Revenue');
    if (data.topItems && data.topItems.length > 0) {
      data.topItems.forEach((item: ReportTopItem) => {
        lines.push(`"${item.nameEn}",${item.qty},${item.revenue}`);
      });
    } else {
      lines.push('No items sold');
    }

    lines.push('');
    if (period === 'daily') {
      lines.push('--- HOURLY BREAKDOWN ---');
      lines.push('Hour,Revenue');
      for (let i = 0; i < 24; i++) {
        if (data.hourlyRevenue && data.hourlyRevenue[i]) {
          lines.push(`${i}:00,${data.hourlyRevenue[i]}`);
        }
      }
    } else {
      lines.push('--- DAILY BREAKDOWN ---');
      lines.push('Date,Revenue');
      if (data.dailyRevenue) {
        Object.entries(data.dailyRevenue).forEach(([date, rev]) => {
          lines.push(`${date},${rev}`);
        });
      }
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="reports" size={24} /> Reports</div>
          <p className="page-subtitle">Revenue and performance analytics</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-primary" onClick={handleExportImage} disabled={exportingImg || loading || (!dailyData && !weeklyData && !monthlyData)} style={{ background: 'var(--accent-gold)' }}>
            {exportingImg ? (<><Icon name="image" size={16} /> Exporting...</>) : (<><Icon name="image" size={16} /> Export Image</>)}
          </button>
          <button className="btn btn-primary" onClick={handleExport} disabled={loading || (!dailyData && !weeklyData && !monthlyData)}>
            <Icon name="chartBar" size={16} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={loadReport} disabled={loading}>
            {loading ? (<><Icon name="loader" size={16} /> Loading...</>) : (<><Icon name="refresh" size={16} /> Refresh</>)}
          </button>
        </div>
      </div>

      <div id="report-export-area" style={{ padding: 'var(--space-4)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)' }}>
        {/* Period Toggle */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '4px', width: 'fit-content' }}>
          {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
            <button
              key={p}
              className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPeriod(p)}
              style={{ textTransform: 'capitalize', minWidth: '90px' }}
            >
              {p === 'daily' ? (<><Icon name="calendar" size={15} /> Daily</>) : p === 'weekly' ? (<><Icon name="calendarDays" size={15} /> Weekly</>) : (<><Icon name="calendarDays" size={15} /> Monthly</>)}
            </button>
          ))}
        </div>

        {/* Date picker for daily */}
        {period === 'daily' && (
          <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <label style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Select Date:</label>
            <input
              type="date"
              className="input"
              value={selectedDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>
        )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-muted)' }}>
          Loading report...
        </div>
      )}

      {/* DAILY REPORT */}
      {!loading && period === 'daily' && dailyData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
            <StatCard icon="coins" label="Total Revenue" value={fp(dailyData.totalRevenue)} color="var(--success)" />
            <StatCard icon="orders" label="Total Orders" value={String(dailyData.totalOrders)} />
            <StatCard icon="banknote" label="Cash" value={fp(dailyData.cashRevenue)} />
            <StatCard icon="creditCard" label="Card" value={fp(dailyData.cardRevenue)} />
            <StatCard icon="smartphone" label="Mobile" value={fp(dailyData.mobileRevenue)} />
            <StatCard icon="calculator" label="Avg Order" value={fp(dailyData.avgOrderValue)} />
          </div>

          {/* Hourly Breakdown */}
          {Object.keys(dailyData.hourlyRevenue).length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', border: '1px solid var(--border)' }}>
              <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="clock" size={16} /> Revenue by Hour</h3>
              <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-end', height: '120px', overflowX: 'auto' }}>
                {Array.from({ length: 24 }, (_, h) => {
                  const val = dailyData.hourlyRevenue[h] || 0;
                  const maxVal = Math.max(...Object.values(dailyData.hourlyRevenue as Record<string, number>), 1);
                  const height = Math.max((val / maxVal) * 100, val > 0 ? 4 : 0);
                  return (
                    <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, minWidth: '28px' }}>
                      <div
                        title={`${h}:00 — ${fp(val)}`}
                        style={{
                          width: '100%', background: val > 0 ? 'var(--accent-gold)' : 'var(--bg-input)',
                          height: `${height}%`, borderRadius: '4px 4px 0 0', transition: 'height 0.3s', minHeight: '2px'
                        }}
                      />
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{h}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Items */}
          {dailyData.topItems.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', border: '1px solid var(--border)' }}>
              <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="trophy" size={16} /> Top Selling Items</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {dailyData.topItems.map((item: ReportTopItem, idx: number) => (
                  <div key={item.nameEn} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2)', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: idx < 3 ? 'var(--accent-gold)' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: idx < 3 ? 'white' : 'var(--text-muted)', flexShrink: 0 }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1 }}>{item.nameEn}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>×{item.qty}</span>
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fp(item.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WEEKLY REPORT */}
      {!loading && period === 'weekly' && weeklyData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
            <StatCard icon="coins" label="7-Day Revenue" value={fp(weeklyData.totalRevenue)} color="var(--success)" />
            <StatCard icon="orders" label="Total Orders" value={String(weeklyData.totalOrders)} />
            <StatCard icon="calendarDays" label="Avg Daily Revenue" value={fp(weeklyData.avgDailyRevenue)} />
          </div>

          {/* Daily bar chart */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="calendarDays" size={16} /> Daily Revenue (Last 7 Days)</h3>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', height: '140px' }}>
              {Object.entries(weeklyData.dailyRevenue as Record<string, number>).map(([date, val]) => {
                const maxVal = Math.max(...Object.values(weeklyData.dailyRevenue as Record<string, number>), 1);
                const height = Math.max((val / maxVal) * 100, val > 0 ? 4 : 0);
                const d = new Date(date);
                const dayName = d.toLocaleDateString('en', { weekday: 'short' });
                return (
                  <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{fp(val)}</span>
                    <div
                      title={`${date} — ${fp(val)}`}
                      style={{
                        width: '100%', background: val > 0 ? 'var(--accent-gold)' : 'var(--bg-input)',
                        height: `${height}%`, borderRadius: '6px 6px 0 0', minHeight: '2px', transition: 'height 0.3s'
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dayName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MONTHLY REPORT */}
      {!loading && period === 'monthly' && monthlyData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', border: '1px solid var(--border)', marginBottom: 'var(--space-2)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Showing data for: </span>
            <span style={{ fontWeight: 600 }}>{new Date(monthlyData.month + '-01').toLocaleDateString('en', { month: 'long', year: 'numeric' })}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
            <StatCard icon="coins" label="Monthly Revenue" value={fp(monthlyData.totalRevenue)} color="var(--success)" />
            <StatCard icon="orders" label="Total Orders" value={String(monthlyData.totalOrders)} />
            <StatCard icon="banknote" label="Cash" value={fp(monthlyData.cashRevenue)} />
            <StatCard icon="creditCard" label="Card" value={fp(monthlyData.cardRevenue)} />
            <StatCard icon="smartphone" label="Mobile" value={fp(monthlyData.mobileRevenue)} />
            <StatCard icon="calculator" label="Avg Order" value={fp(monthlyData.avgOrderValue)} />
          </div>

          {/* Top Items this month */}
          {monthlyData.topItems.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', border: '1px solid var(--border)' }}>
              <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Icon name="trophy" size={16} /> Top Items This Month (by Revenue)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {monthlyData.topItems.map((item: ReportTopItem, idx: number) => {
                  const maxRev = monthlyData.topItems[0]?.revenue || 1;
                  return (
                    <div key={item.nameEn}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: idx < 3 ? 600 : 400 }}>{idx + 1}. {item.nameEn}</span>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{fp(item.revenue)} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>×{item.qty}</span></span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(item.revenue / maxRev) * 100}%`, background: idx === 0 ? 'var(--accent-gold)' : 'var(--accent-gold-hover)', borderRadius: '99px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && period === 'daily' && !dailyData && (
        <div className="empty-state"><div className="empty-state-icon"><Icon name="reports" size={48} /></div><div className="empty-state-title">No data for this date</div></div>
      )}
      </div>
      
      {/* Hidden container specifically for high-quality image exports */}
      <ComprehensiveReportExport 
        ref={exportRef}
        period={period}
        title={period === 'daily' ? `Daily Performance - ${selectedDate}` : period === 'weekly' ? '7-Day Performance Overview' : 'Monthly Performance Overview'}
        data={(period === 'daily' ? dailyData : period === 'weekly' ? weeklyData : monthlyData) as ReportData | null}
      />
    </div>
  );
}
