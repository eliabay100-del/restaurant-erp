import { NextResponse } from 'next/server';
import { flushOutboundEvents } from '@/lib/integrations/outbox';

function isAuthorized(request: Request): boolean {
  const expected = process.env.OUTBOX_CRON_SECRET;
  // In development allow unauthenticated calls so the hook is easy to test.
  if (!expected && process.env.NODE_ENV !== 'production') return true;
  if (!expected) return false;
  const provided = request.headers.get('authorization');
  return provided === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 401 });
  }
  try {
    const result = await flushOutboundEvents();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Flush outbox error:', error);
    return NextResponse.json({ success: false, error: 'Failed to flush outbox' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Convenience for manual testing / monitors.
  return POST(request);
}