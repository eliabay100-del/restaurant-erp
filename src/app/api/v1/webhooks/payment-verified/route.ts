import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveApiKeyFromRequest, hasScope } from '@/lib/integrations/api-keys';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const key = await resolveApiKeyFromRequest(request);
  if (!key) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 401 });
  }
  if (!hasScope(key.scopes, 'webhooks:write')) {
    return NextResponse.json({ success: false, error: 'Missing scope: webhooks:write' }, { status: 403 });
  }

  let body: { orderId?: unknown; verdict?: unknown; reference?: unknown; idempotencyKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const orderId = Number(body?.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid orderId' }, { status: 400 });
  }
  const verdict = body?.verdict;
  if (verdict !== 'verified' && verdict !== 'declined' && verdict !== 'void') {
    return NextResponse.json({ success: false, error: 'Invalid verdict' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : null;
  const noteToken = idempotencyKey ? `verifier:${idempotencyKey}` : `verifier:${verdict}:${orderId}`;
  if (order.note && order.note.includes(noteToken)) {
    return NextResponse.json({ success: true, data: { orderId, verdict, applied: false }, meta: { requestId: crypto.randomUUID(), issuedAt: new Date().toISOString() } });
  }

  const ref = typeof body?.reference === 'string' ? body.reference : null;
  const annotation = ` [Verifier ${verdict}${ref ? ` ref:${ref}` : ''} ${noteToken}]`;
  const suffix = verdict === 'void' ? ' (order voided by verifier)' : '';
  await prisma.order.update({
    where: { id: orderId },
    data: { note: (order.note ?? '') + annotation + suffix },
  });

  return NextResponse.json({
    success: true,
    data: { orderId, verdict, applied: true },
    meta: { requestId: crypto.randomUUID(), issuedAt: new Date().toISOString() },
  });
}