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

  let body: { orderId?: unknown; verdict?: unknown; reference?: unknown; idempotencyKey?: unknown; event?: unknown; data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Support both old format (verdict/reference) and new event format (event/data)
  let verdict: string | undefined;
  let ref: string | null = null;
  let rawOrderId: unknown;

  if (body?.event === 'verification.completed' && body?.data && typeof body.data === 'object') {
    const data = body.data as Record<string, unknown>;
    ref = typeof data.transaction_id === 'string' ? data.transaction_id : null;
    rawOrderId = data.order_id;
    verdict = data.status === 'verified' ? 'verified' : 'declined';
  } else {
    verdict = body?.verdict as string | undefined;
    ref = typeof body?.reference === 'string' ? body.reference : null;
    rawOrderId = body?.orderId;
  }

  if (verdict !== 'verified' && verdict !== 'declined' && verdict !== 'void') {
    return NextResponse.json({ success: false, error: 'Invalid verdict' }, { status: 400 });
  }

  let order: { id: number; note: string | null } | null = null;

  if (Number.isInteger(rawOrderId) && (rawOrderId as number) > 0) {
    order = await prisma.order.findUnique({ where: { id: rawOrderId as number } });
  }

  if (!order && ref) {
    const payment = await prisma.payment.findFirst({ where: { reference: ref } });
    if (payment) {
      order = await prisma.order.findUnique({ where: { id: payment.orderId } });
    }
  }

  if (!order) {
    return NextResponse.json(
      { success: false, error: rawOrderId ? 'Order not found' : 'No matching order found for reference' },
      { status: 404 }
    );
  }

  const verificationStatus = verdict === 'verified' ? 'VERIFIED' : verdict === 'void' ? null : 'DECLINED';

  const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        verificationStatus,
        verifiedAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: { orderId: order.id, verdict, applied: true },
    meta: { requestId: crypto.randomUUID(), issuedAt: new Date().toISOString() },
  });
}