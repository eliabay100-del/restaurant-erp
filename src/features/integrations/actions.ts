'use server';

import { authorize, MANAGEMENT_ROLES } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateApiKey } from '@/lib/integrations/api-keys';
import { encryptSecret } from '@/lib/integrations/secrets';
import { emitOutboundEvent, flushOutboundEvents } from '@/lib/integrations/outbox';

export async function getIntegrationSnapshot() {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false as const, error: auth.error };

  const endpoints = await prisma.webhookEndpoint.findMany({ orderBy: { createdAt: 'asc' } });
  const apiKeys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'asc' } });
  const pending = await prisma.outboundEvent.count({ where: { status: { in: ['PENDING', 'FAILED'] } } });
  const delivered = await prisma.outboundEvent.count({ where: { status: 'SENT' } });
  const recentRaw = await prisma.outboundEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { id: true, kind: true, status: true, attempts: true, lastError: true, createdAt: true, aggregateId: true },
  });
  const recent = recentRaw.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));

  return {
    success: true as const,
    data: {
      endpoints: endpoints.map((e) => ({
        id: e.id,
        name: e.name,
        url: e.url,
        secretPreview: '••••' + e.secret.slice(-4),
        enabled: e.enabled,
        events: e.events.split(',').map((x) => x.trim()).filter(Boolean),
        createdAt: e.createdAt.toISOString(),
      })),
      apiKeys: apiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes.split(',').map((x) => x.trim()).filter(Boolean),
        createdAt: k.createdAt.toISOString(),
        revokedAt: k.revokedAt?.toISOString() ?? null,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      })),
      outbox: { pending, delivered, recent },
      cronConfigured: !!process.env.OUTBOX_CRON_SECRET,
      webhookConfigured: !!process.env.INTEGRATION_WEBHOOK_URL,
    },
  };
}

export type IntegrationResult = { success: boolean; error?: string; data?: unknown };

export async function createWebhookEndpoint(input: {
  name: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
}): Promise<IntegrationResult> {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    new URL(input.url);
  } catch {
    return { success: false, error: 'Invalid URL' };
  }
  if (!input.name?.trim()) return { success: false, error: 'Name required' };
  if (!input.secret?.trim()) return { success: false, error: 'Secret required' };

  const { value, encrypted } = encryptSecret(input.secret.trim());
  await prisma.webhookEndpoint.create({
    data: {
      name: input.name.trim(),
      url: input.url.trim(),
      secret: value,
      secretEncrypted: encrypted,
      events: (input.events ?? []).join(','),
      enabled: input.enabled ?? true,
    },
  });
  return { success: true };
}

export async function toggleWebhookEndpoint(id: number, enabled: boolean): Promise<IntegrationResult> {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };
  await prisma.webhookEndpoint.update({ where: { id }, data: { enabled } });
  return { success: true };
}

export async function deleteWebhookEndpoint(id: number): Promise<IntegrationResult> {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };
  await prisma.webhookEndpoint.delete({ where: { id } });
  return { success: true };
}

export async function generateApiKeyAction(input: { name: string; scopes: string[] }): Promise<
  { success: true; key: string; prefix: string; id: number } | { success: false; error: string }
> {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!input.name?.trim()) return { success: false, error: 'Name required' };

  const gen = generateApiKey();
  const row = await prisma.apiKey.create({
    data: {
      name: input.name.trim(),
      keyHash: gen.keyHash,
      prefix: gen.prefix,
      scopes: (input.scopes.length ? input.scopes : ['orders:read']).join(','),
      createdById: auth.session.staffId,
    },
  });
  return { success: true, key: gen.raw, prefix: gen.prefix, id: row.id };
}

export async function revokeApiKeyAction(id: number): Promise<IntegrationResult> {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return { success: true };
}

export async function deleteApiKeyAction(id: number): Promise<IntegrationResult> {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };
  await prisma.apiKey.delete({ where: { id } });
  return { success: true };
}

export async function sendTestEventAction(): Promise<IntegrationResult & { flushed?: unknown }> {
  const auth = await authorize(MANAGEMENT_ROLES);
  if (!auth.ok) return { success: false, error: auth.error };

  await emitOutboundEvent(prisma, 'order.created', 0, {
    test: true,
    issuedAt: new Date().toISOString(),
    note: 'Integration test event from /settings/integrations',
  });

  const flushed = await flushOutboundEvents();
  return { success: true, flushed };
}