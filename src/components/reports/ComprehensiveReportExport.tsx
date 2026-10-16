import React from 'react';

/** One aggregated menu item as referenced by the report payloads. */
export interface ReportTopItem {
  id?: number;
  nameEn: string;
  qty: number;
  revenue: number;
}

/** The report payload shape this export template renders. */
export interface ReportData {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  cashRevenue: number;
  cardRevenue: number;
  mobileRevenue: number;
  hourlyRevenue: Record<number, number>;
  dailyRevenue: Record<string, number>;
  topItems: ReportTopItem[];
}

export const ComprehensiveReportExport = React.forwardRef<HTMLDivElement, { data: ReportData | null, period: string, title: string }>(
  ({ data, period, title }, ref) => {
    if (!data) return <div ref={ref} style={{ display: 'none' }} />;

    const maxTimeVal = Math.max(
      ...Object.values((period === 'daily' ? data.hourlyRevenue : data.dailyRevenue) as Record<string, number> || { '0': 1 })
    );

    const totalRevenue = data.totalRevenue || 1; // prevent div by zero
    const cashPct = ((data.cashRevenue || 0) / totalRevenue) * 100;
    const cardPct = ((data.cardRevenue || 0) / totalRevenue) * 100;
    const mobilePct = ((data.mobileRevenue || 0) / totalRevenue) * 100;

    const timeData = period === 'daily' ? data.hourlyRevenue : data.dailyRevenue;
    
    // Sort items by revenue and qty
    const topByRev = [...(data.topItems || [])].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const topByQty = [...(data.topItems || [])].sort((a, b) => b.qty - a.qty).slice(0, 5);

    const maxRevItem = Math.max(...topByRev.map(i => i.revenue), 1);
    const maxQtyItem = Math.max(...topByQty.map(i => i.qty), 1);

    return (
      <div 
        id="comprehensive-export-wrapper"
        ref={ref}
        style={{
          position: 'absolute',
          top: '-10000px', // Hide offscreen
          left: 0,
          width: '1200px', // Fixed wide size for good rendering
          background: '#ffffff',
          color: '#1e293b',
          padding: '40px',
          fontFamily: 'system-ui, sans-serif',
          boxSizing: 'border-box',
          zIndex: -1
        }}
      >
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '30px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '32px', color: '#0f172a' }}>Business Performance Report</h1>
            <p style={{ margin: '8px 0 0', fontSize: '18px', color: '#64748b' }}>{title}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>Warka Dine POS</div>
            <div style={{ fontSize: '14px', color: '#94a3b8' }}>Generated: {new Date().toLocaleString()}</div>
          </div>
        </div>

        {/* KEY METRICS */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '40px' }}>
          <div style={{ flex: 1, background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: '16px', marginBottom: '8px' }}>Total Revenue</div>
            <div style={{ color: '#10b981', fontSize: '36px', fontWeight: 'bold' }}>{data.totalRevenue.toLocaleString()} ETB</div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: '16px', marginBottom: '8px' }}>Total Orders</div>
            <div style={{ color: '#0f172a', fontSize: '36px', fontWeight: 'bold' }}>{data.totalOrders}</div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: '16px', marginBottom: '8px' }}>Avg Order Value</div>
            <div style={{ color: '#0f172a', fontSize: '36px', fontWeight: 'bold' }}>{data.avgOrderValue.toLocaleString()} ETB</div>
          </div>
        </div>

        {/* MAIN GRAPHS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', marginBottom: '40px' }}>
          
          {/* Revenue Trend Chart */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ marginTop: 0, fontSize: '20px', color: '#0f172a', marginBottom: '24px' }}>
              {period === 'daily' ? 'Hourly Revenue Trend' : 'Daily Revenue Trend'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '250px' }}>
              {timeData && Object.entries(timeData).map(([key, val]: [string, number]) => {
                const height = Math.max((val / (maxTimeVal || 1)) * 100, val > 0 ? 2 : 0);
                return (
                  <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>{val > 0 ? val.toLocaleString() : ''}</div>
                    <div style={{ 
                      width: '100%', 
                      background: val > 0 ? '#f59e0b' : '#f1f5f9', 
                      height: `${height}%`, 
                      borderRadius: '4px 4px 0 0',
                      minHeight: '2px'
                    }} />
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {period === 'daily' ? `${key}:00` : new Date(key).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Breakdown Chart */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ marginTop: 0, fontSize: '20px', color: '#0f172a', marginBottom: '24px' }}>Payment Split</h2>
            
            <div style={{ height: '40px', display: 'flex', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ width: `${cashPct}%`, background: '#10b981' }} />
              <div style={{ width: `${cardPct}%`, background: '#3b82f6' }} />
              <div style={{ width: `${mobilePct}%`, background: '#8b5cf6' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#10b981' }} />
                  <span style={{ fontSize: '16px', color: '#334155' }}>Cash</span>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{data.cashRevenue.toLocaleString()} ETB ({cashPct.toFixed(1)}%)</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#3b82f6' }} />
                  <span style={{ fontSize: '16px', color: '#334155' }}>Card</span>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{data.cardRevenue.toLocaleString()} ETB ({cardPct.toFixed(1)}%)</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#8b5cf6' }} />
                  <span style={{ fontSize: '16px', color: '#334155' }}>Mobile</span>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{data.mobileRevenue.toLocaleString()} ETB ({mobilePct.toFixed(1)}%)</div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM GRAPHS GRID (Top Items) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          
          {/* Top by Revenue */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ marginTop: 0, fontSize: '20px', color: '#0f172a', marginBottom: '24px' }}>Top Items by Revenue</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {topByRev.map((item, idx) => (
                <div key={item.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                    <span style={{ color: '#334155', fontWeight: '500' }}>{item.nameEn}</span>
                    <span style={{ fontWeight: 'bold' }}>{item.revenue.toLocaleString()} ETB</span>
                  </div>
                  <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${(item.revenue / maxRevItem) * 100}%`, height: '100%', background: '#f59e0b', borderRadius: '6px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top by Volume */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ marginTop: 0, fontSize: '20px', color: '#0f172a', marginBottom: '24px' }}>Top Items by Volume</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {topByQty.map((item, idx) => (
                <div key={item.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                    <span style={{ color: '#334155', fontWeight: '500' }}>{item.nameEn}</span>
                    <span style={{ fontWeight: 'bold' }}>{item.qty} units</span>
                  </div>
                  <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${(item.qty / maxQtyItem) * 100}%`, height: '100%', background: '#10b981', borderRadius: '6px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }
);

ComprehensiveReportExport.displayName = 'ComprehensiveReportExport';
