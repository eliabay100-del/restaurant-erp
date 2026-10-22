import { NextRequest, NextResponse } from 'next/server';
import { pcheck } from '@/lib/pcheck';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('x-webhook-signature') || '';

  try {
    // Verify signature and parse payload
    const webhook = pcheck.parseWebhook(payload, signature);

    console.log('P-Check webhook received:', {
      event: webhook.event,
      verificationId: webhook.data.id,
      status: webhook.data.status,
    });

    // Find payment by request ID
    const payment = await prisma.payment.findFirst({
      where: { pcheckRequestId: webhook.data.id },
      include: { order: true },
    });

    if (!payment) {
      console.error('Payment not found for verification:', webhook.data.id);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Update payment based on verification result
    if (webhook.data.status === 'verified') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          reference: webhook.data.id,
        },
      });

      console.log('Payment verified successfully:', {
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: webhook.data.verified_amount,
      });
    } else {
      console.warn('Payment verification failed:', {
        paymentId: payment.id,
        status: webhook.data.status,
      });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    if (error instanceof Error && error.message.includes('Invalid webhook signature')) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
