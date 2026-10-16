import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export type OutboundEventKind =
  | 'order.created'
  | 'order.status.changed'
  | 'payment.completed';

export interface EmitOutboundEventArgs {
  kind: OutboundEventKind;
  aggregateId?: number | null;
  payload: unknown;
}

/**
 * Enqueue an event in the same transaction as the business write that produced
 * it. The outbox drainer (`flushOutboundEvents`) is responsible for delivering
 * the event to any configured integration endpoint.
 *
 * Use the transaction client (`tx`) when called inside `prisma.$transaction`,
 * otherwise pass `prisma` directly for fire-and-forget enqueues.
 */
export async function emitOutboundEvent(
  tx: Prisma.TransactionClient | typeof prisma,
  kind: OutboundEventKind,
  aggregateId: number | null,
  payload: unknown
): Promise<void> {
  await tx.outboundEvent.create({
    data: {
      kind,
      aggregateId: aggregateId ?? undefined,
      payload: JSON.stringify(payload),
    },
  });
}

interface FlushResult {
  id: number;
  kind: string;
  sent: boolean;
  error: string | null;
}

/**
 * Drain the outbox. Returns a summary of what happened. Safe to call repeatedly.
 * If `INTEGRATION_WEBHOOK_URL` is unset there is no receiver configured, so
 * events are still marked SENT locally (the row remains in the log for audit
 * until a verifier endpoint is wired in).
 */
export async function flushOutboundEvents(limit = 50): Promise<{
  processed: number;
  delivered: number;
  failed: number;
  results: FlushResult[];
}> {
  const eligible = await prisma.outboundEvent.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const results: FlushResult[] = [];
  let delivered = 0;
  let failed = 0;

  const webhookUrl = process.env.INTEGRATION_WEBHOOK_URL;
  const secret = process.env.INTEGRATION_WEBHOOK_SECRET;

  for (const ev of eligible) {
    const claimed = await prisma.outboundEvent.updateMany({
      where: { id: ev.id, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'IN_FLIGHT', attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    const attempt = ev.attempts + 1;
    let sent = false;
    let error: string | null = null;

    if (webhookUrl) {
      try {
        const body = JSON.stringify({
          id: ev.id,
          kind: ev.kind,
          aggregateId: ev.aggregateId,
          payload: JSON.parse(ev.payload),
          createdAt: ev.createdAt.toISOString(),
        });

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (secret) {
          const ts = String(Date.now());
          const crypto = await import('crypto');
          const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
          headers['X-Webhook-Timestamp'] = ts;
          headers['X-Webhook-Signature'] = `sha256=${sig}`;
        }

        const res = await fetch(webhookUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
        sent = true;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    } else {
      // No receiver configured yet — treat as delivered locally.
      sent = true;
    }

    const backoffMs = Math.min(60_000, 1000 * 2 ** Math.min(attempt, 10));
    await prisma.outboundEvent.update({
      where: { id: ev.id },
      data: sent
        ? { status: 'SENT', deliveredAt: new Date(), lastError: null }
        : { status: 'FAILED', lastError: error, nextAttemptAt: new Date(Date.now() + backoffMs) },
    });

    if (sent) delivered++;
    else failed++;

    results.push({ id: ev.id, kind: ev.kind, sent, error });
  }

  return { processed: results.length, delivered, failed, results };
}
