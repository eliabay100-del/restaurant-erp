import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveApiKeyFromRequest, hasScope } from '@/lib/integrations/api-keys';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const key = await resolveApiKeyFromRequest(request);
  if (!key) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 401 });
  }
  if (!hasScope(key.scopes, 'orders:read')) {
    return NextResponse.json({ success: false, error: 'Missing scope: orders:read' }, { status: 403 });
  }

  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid order id' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true, staff: { select: { name: true, nameAm: true, role: true } } },
  });
  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: order,
    meta: { requestId: crypto.randomUUID(), issuedAt: new Date().toISOString() },
  });
}