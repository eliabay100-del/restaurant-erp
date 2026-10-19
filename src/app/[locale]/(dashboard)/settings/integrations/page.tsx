'use client';

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '@/context/AuthProvider';
import {
  getIntegrationSnapshot,
  generateApiKeyAction,
  revokeApiKeyAction,
  createDatabaseBackupAction,
  listDatabaseBackupsAction,
  deleteDatabaseBackupAction,
} from '@/features/integrations/actions';

type Key = { id: number; name: string; prefix: string; scopes: string[]; createdAt: string; revokedAt: string | null; lastUsedAt: string | null };
type Snapshot = {
  endpoints: unknown[];
  apiKeys: Key[];
  outbox: { pending: number; delivered: number };
  cronConfigured: boolean;
  webhookConfigured: boolean;
};

export default function IntegrationsSettingsPage() {
  const { staff } = useAuth();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [backups, setBackups] = useState<{ filename: string; size: number; createdAt: string }[]>([]);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await getIntegrationSnapshot();
      if (!res.success) setMsg(res.error ?? 'Failed to load');
      else {
        setSnap(res.data as Snapshot);
        const hasKey = (res.data as Snapshot).apiKeys.some(
          (k) => !k.revokedAt && k.name === 'P-Check'
        );
        setConnected(hasKey);
      }
    } catch (e) {
      setMsg(String(e));
    }
  };

  useEffect(() => {
    const id = setTimeout(() => { refresh(); loadBackups(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const generateKey = () => {
    setMsg(null);
    setCreatedKey(null);
    startTransition(async () => {
      const keyRes = await generateApiKeyAction({
        name: 'P-Check',
        scopes: ['orders:read', 'webhooks:write'],
      });
      if (!keyRes.success) {
        setMsg('Failed: ' + (keyRes.error ?? 'Unknown error'));
        return;
      }
      setCreatedKey(keyRes.key);
      setConnected(true);
      setMsg('API key created! Copy it and paste it in your P-Check dashboard under ERP Integrations.');
      refresh();
    });
  };

  const disconnect = () => {
    startTransition(async () => {
      if (snap) {
        for (const k of snap.apiKeys) {
          if (!k.revokedAt && k.name === 'P-Check') {
            await revokeApiKeyAction(k.id);
          }
        }
      }
      setConnected(false);
      setCreatedKey(null);
      setMsg('Disconnected from P-Check.');
      refresh();
    });
  };

  async function loadBackups() {
    const r = await listDatabaseBackupsAction();
    if (r.success) setBackups(r.backups);
  }

  const handleBackup = (schedule: 'daily' | 'weekly' | 'monthly') => {
    setBackupMsg(null);
    startTransition(async () => {
      const r = await createDatabaseBackupAction(schedule);
      if (!r.success) setBackupMsg('❌ ' + (r.error ?? 'failed'));
      else {
        setBackupMsg(`✅ Backup created: ${r.filename} (${(r.size / 1024).toFixed(1)} KB)`);
        loadBackups();
      }
    });
  };

  const handleDeleteBackup = (filename: string) => {
    startTransition(async () => {
      await deleteDatabaseBackupAction(filename);
      loadBackups();
    });
  };

  if (!staff) {
    return <div style={{ padding: 24 }}>Please sign in as administrator.</div>;
  }

  const card: React.CSSProperties = { background: 'var(--bg-secondary, #f8fafc)', borderRadius: 16, padding: 20, border: '1px solid var(--border, #e2e8f0)', marginBottom: 16 };
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', marginRight: 8, fontSize: 13, fontWeight: 500 };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 16 }}>
      {msg && (
        <div style={{
          padding: 12, marginBottom: 16, borderRadius: 8,
          background: msg.startsWith('Failed') ? '#fef2f2' : '#ecfdf5',
          color: msg.startsWith('Failed') ? '#991b1b' : '#166534',
          fontSize: 14,
        }}>
          {msg}
        </div>
      )}

      {createdKey && (
        <div style={{
          padding: 16, marginBottom: 20, borderRadius: 8,
          background: '#fefce8', border: '2px solid #fde68a',
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
            Copy this API key now (won&apos;t show again):
          </div>
          <code style={{
            display: 'block', padding: 12, borderRadius: 6,
            background: '#fff', border: '1px solid #e2e8f0',
            fontSize: 13, wordBreak: 'break-all', fontFamily: 'monospace',
          }}>
            {createdKey}
          </code>
        </div>
      )}

      {!connected ? (
        <button
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 8,
            border: 'none', background: '#010103', color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            opacity: pending ? 0.5 : 1,
          }}
          onClick={generateKey}
          disabled={pending}
        >
          {pending ? 'Connecting...' : 'Connect to P-Check'}
        </button>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 16, borderRadius: 8,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: '#166534' }}>P-Check Connected</span>
          </div>
          <button
            style={{
              padding: '6px 14px', borderRadius: 6,
              border: '1px solid #fecaca', background: '#fff',
              color: '#dc2626', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
            onClick={disconnect}
            disabled={pending}
          >
            Disconnect
          </button>
        </div>
      )}

      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Database backup</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
          Create a snapshot of the live database. Files are stored in <code>backups/</code> on the server.
        </p>
        {backupMsg && (
          <div style={{ padding: 10, marginBottom: 12, borderRadius: 6, background: '#eef2ff', color: '#3730a3', fontSize: 13 }}>
            {backupMsg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button style={btn} onClick={() => handleBackup('daily')} disabled={pending}>
            {pending ? 'Working…' : 'Backup (Daily)'}
          </button>
          <button style={btn} onClick={() => handleBackup('weekly')} disabled={pending}>
            {pending ? 'Working…' : 'Backup (Weekly)'}
          </button>
          <button style={btn} onClick={() => handleBackup('monthly')} disabled={pending}>
            {pending ? 'Working…' : 'Backup (Monthly)'}
          </button>
        </div>
        {backups.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>No backups yet.</div>
        ) : (
          <div>
            {backups.map((b) => (
              <div key={b.filename} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid #e2e8f0', alignItems: 'center', fontSize: 13 }}>
                <div>
                  <b>{b.filename}</b>
                  <div style={{ color: '#94a3b8' }}>{(b.size / 1024).toFixed(1)} KB · {new Date(b.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <a href={`/api/v1/backup/${b.filename}`} style={{ ...btn, background: '#0284c7', textDecoration: 'none', display: 'inline-block' }}>Download</a>
                  <button style={{ ...btn, background: '#dc2626' }} onClick={() => handleDeleteBackup(b.filename)} disabled={pending}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
