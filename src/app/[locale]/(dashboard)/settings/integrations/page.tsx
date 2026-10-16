'use client';

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '@/context/AuthProvider';
import {
  getIntegrationSnapshot,
  createWebhookEndpoint,
  toggleWebhookEndpoint,
  deleteWebhookEndpoint,
  generateApiKeyAction,
  revokeApiKeyAction,
  deleteApiKeyAction,
  sendTestEventAction,
} from '@/features/integrations/actions';

type Endpoint = { id: number; name: string; url: string; secretPreview: string; enabled: boolean; events: string[]; createdAt: string };
type Key = { id: number; name: string; prefix: string; scopes: string[]; createdAt: string; revokedAt: string | null; lastUsedAt: string | null };
type Recent = { id: number; kind: string; status: string; attempts: number; lastError: string | null; createdAt: string; aggregateId: number | null };
type Snapshot = {
  endpoints: Endpoint[];
  apiKeys: Key[];
  outbox: { pending: number; delivered: number; recent: Recent[] };
  cronConfigured: boolean;
  webhookConfigured: boolean;
};

export default function IntegrationsSettingsPage() {
  const { staff } = useAuth();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const [epName, setEpName] = useState('');
  const [epUrl, setEpUrl] = useState('');
  const [epSecret, setEpSecret] = useState('');
  const [epEvents, setEpEvents] = useState('payment.completed,order.created,order.status.changed');
  const [epEnabled, setEpEnabled] = useState(true);

  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState('orders:read');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await getIntegrationSnapshot();
      if (!res.success) setErr(res.error);
      else setSnap(res.data as Snapshot);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => { refresh(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const addEndpoint = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await createWebhookEndpoint({
        name: epName,
        url: epUrl,
        secret: epSecret,
        events: epEvents.split(',').map((s) => s.trim()).filter(Boolean),
        enabled: epEnabled,
      });
      if (!res.success) setMsg('❌ ' + (res.error ?? 'failed'));
      else {
        setMsg('✅ Webhook endpoint added');
        setEpName(''); setEpUrl(''); setEpSecret(''); setEpEvents('payment.completed,order.created,order.status.changed');
        refresh();
      }
    });
  };

  const addKey = () => {
    setMsg(null);
    setCreatedKey(null);
    startTransition(async () => {
      const res = await generateApiKeyAction({ name: keyName, scopes: keyScopes.split(',').map((s) => s.trim()).filter(Boolean) });
      if (!res.success) setMsg('❌ ' + (res.error ?? 'failed'));
      else {
        setMsg('✅ API key created — copy now, shown once.');
        setCreatedKey(res.key);
        setKeyName(''); setKeyScopes('orders:read');
        refresh();
      }
    });
  };

  const sendTest = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await sendTestEventAction();
      if (!res.success) setMsg('❌ ' + (res.error ?? 'failed'));
      else { setMsg('✅ Test event enqueued & flushed'); refresh(); }
    });
  };

  const card: React.CSSProperties = { background: 'var(--bg-secondary, #f8fafc)', borderRadius: 12, padding: 16, border: '1px solid var(--border, #e2e8f0)', marginBottom: 16 };
  const inp: React.CSSProperties = { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 8 };
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', marginRight: 8 };

  if (!staff) {
    return <div style={{ padding: 24 }}>Please sign in as administrator.</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Integrations</h1>
      <p style={{ color: '#64748b', marginBottom: 16 }}>
        Connect external apps (e.g., a payment verifier). Outbox drainer runs via cron against <code>/api/cron/flush-outbox</code>.
      </p>

      {msg && <div style={{ padding: 10, marginBottom: 12, borderRadius: 6, background: '#eef2ff', color: '#3730a3' }}>{msg}</div>}
      {err && <div style={{ padding: 10, marginBottom: 12, borderRadius: 6, background: '#fee2e2', color: '#991b1b' }}>{err}</div>}

      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Outbox status</h2>
        <div>Pending: <b>{snap?.outbox.pending ?? '…'}</b> · Delivered: <b>{snap?.outbox.delivered ?? '…'}</b></div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Cron configured: {snap?.cronConfigured ? '✅ (OUTBOX_CRON_SECRET set)' : '⚠️ not set — cron endpoint is locked (401)'} ·
          Env webhook: {snap?.webhookConfigured ? 'SET' : 'not set'}
        </div>
        <button style={{ ...btn, marginTop: 8 }} onClick={() => { sendTest(); }} disabled={pending}>
          {pending ? 'Sending…' : 'Send test event'}
        </button>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Webhook endpoints (outbound)</h2>
        {snap?.endpoints.length === 0 && <div style={{ color: '#94a3b8', marginBottom: 8 }}>No endpoints configured.</div>}
        {snap?.endpoints.map((e) => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
            <div>
              <b>{e.name}</b> <span style={{ fontSize: 12, color: '#64748b' }}>{e.url}</span>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{e.events.join(', ') || '(none)'}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...btn, background: e.enabled ? '#16a34a' : '#94a3b8' }} onClick={() => startTransition(async () => { await toggleWebhookEndpoint(e.id, !e.enabled); refresh(); })}>{e.enabled ? 'Enabled' : 'Disabled'}</button>
              <button style={{ ...btn, background: '#dc2626' }} onClick={() => startTransition(async () => { await deleteWebhookEndpoint(e.id); refresh(); })}>Delete</button>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Add endpoint</h3>
          <input style={inp} placeholder="Name (e.g. Verifier)" value={epName} onChange={(e) => setEpName(e.target.value)} />
          <input style={inp} placeholder="Webhook URL (https://.../notify)" value={epUrl} onChange={(e) => setEpUrl(e.target.value)} />
          <input style={inp} placeholder="HMAC secret (shared)" value={epSecret} onChange={(e) => setEpSecret(e.target.value)} />
          <input style={inp} placeholder="Events (comma-separated)" value={epEvents} onChange={(e) => setEpEvents(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <input type="checkbox" checked={epEnabled} onChange={(e) => setEpEnabled(e.target.checked)} /> Enabled
          </label>
          <button style={btn} onClick={addEndpoint} disabled={pending || !epName || !epUrl || !epSecret}>{pending ? 'Saving…' : 'Save endpoint'}</button>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>API keys (inbound access)</h2>
        {createdKey && (
          <div style={{ padding: 10, marginBottom: 12, borderRadius: 6, background: '#ecfccb', color: '#365314', wordBreak: 'break-all' }}>
            <b>Copy now — shown once:</b> <code>{createdKey}</code>
          </div>
        )}
        {snap?.apiKeys.length === 0 && <div style={{ color: '#94a3b8', marginBottom: 8 }}>No API keys generated.</div>}
        {snap?.apiKeys.map((k) => (
          <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
            <div>
              <b>{k.name}</b> <code style={{ fontSize: 12, color: '#64748b' }}>{k.prefix}…</code>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{k.scopes.join(', ')}</div>
              {k.revokedAt && <div style={{ fontSize: 12, color: '#dc2626' }}>revoked {k.revokedAt}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!k.revokedAt && (
                <>
                  <button style={{ ...btn, background: '#dc2626' }} onClick={() => startTransition(async () => { await revokeApiKeyAction(k.id); refresh(); })}>Revoke</button>
                  <button style={{ ...btn, background: '#7f1d1d' }} onClick={() => startTransition(async () => { await deleteApiKeyAction(k.id); refresh(); })}>Delete</button>
                </>
              )}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Generate key</h3>
          <input style={inp} placeholder="Name (e.g. Verifier)" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
          <input style={inp} placeholder="Scopes (comma-separated): orders:read, webhooks:write" value={keyScopes} onChange={(e) => setKeyScopes(e.target.value)} />
          <button style={btn} onClick={addKey} disabled={pending || !keyName}>{pending ? 'Generating…' : 'Generate key'}</button>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Recent outbox deliveries</h2>
        {snap?.outbox.recent.length === 0 && <div style={{ color: '#94a3b8' }}>None yet.</div>}
        {snap?.outbox.recent.map((r) => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 6, borderBottom: '1px solid #e2e8f0', fontSize: 13, alignItems: 'center' }}>
            <div><b>#{r.id}</b> {r.kind} <span style={{ color: '#94a3b8' }}>(agg {r.aggregateId ?? '-'})</span></div>
            <div style={{ color: r.status === 'SENT' ? '#16a34a' : r.status === 'FAILED' ? '#dc2626' : '#94a3b8' }}>
              {r.status} {r.attempts > 0 ? `(attempts ${r.attempts})` : ''}
              {r.lastError ? ` — ${r.lastError}` : ''}
            </div>
          </div>
        ))}
        {loading && <div style={{ marginTop: 8, color: '#64748b' }}>Loading…</div>}
      </div>

      {staff && staff.role !== 'ADMIN' && (
        <div style={{ color: '#dc2626', fontSize: 13 }}>You must be an administrator to manage integrations.</div>
      )}
    </div>
  );
}