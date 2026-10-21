import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHmac } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-webhook-signature');
    const body = await request.text();
    const payload = JSON.parse(body);

    const { payment_id, order_id, status, transaction_id, verified_amount, verified_at } = payload;

    // Get payment to retrieve callback secret
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify webhook signature if secret exists
    if (payment.callbackSecret && signature) {
      const expectedSignature = 'sha256=' + createHmac('sha256', payment.callbackSecret)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Update payment with verification result
    await prisma.payment.update({
      where: { id: payment_id },
      data: {
        verificationStatus: status === 'verified' ? 'VERIFIED' : 'DECLINED',
        reference: transaction_id,
        verifiedAt: verified_at ? new Date(verified_at) : new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('P-Check callback error:', error);
    return NextResponse.json(
      { error: 'Failed to process callback' },
      { status: 500 }
    );
  }
}
