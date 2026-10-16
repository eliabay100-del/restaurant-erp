import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const pending = await prisma.outboundEvent.count({
    where: { status: { in: ['PENDING', 'FAILED'] } },
  });
  return NextResponse.json({
    ok: true,
    service: 'warka-dine',
    version: '1.0',
    outbox: { pending },
    issuedAt: new Date().toISOString(),
  });
}