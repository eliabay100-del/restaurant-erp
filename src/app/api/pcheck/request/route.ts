import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PCHECK_API_URL = process.env.PCHECK_API_URL || 'http://localhost:8000/api';
const PCHECK_API_KEY = process.env.PCHECK_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { orderId, orderNumber, tableNumber, amount } = await request.json();

    if (!PCHECK_API_KEY) {
      return NextResponse.json(
        { error: 'P-Check not configured' },
        { status: 500 }
      );
    }

    // Create a pending payment record
    const payment = await prisma.payment.create({
      data: {
        orderId,
        method: 'MOBILE',
        amountPaid: amount,
        amountDue: amount,
        changeGiven: 0,
        verificationStatus: 'PENDING',
      },
    });

    // Send verification request to P-Check
    const pcheckResponse = await fetch(`${PCHECK_API_URL}/v1/verification-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PCHECK_API_KEY}`,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_number: orderNumber,
        table_number: tableNumber,
        amount: amount,
        currency: 'ETB',
        callback_url: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/pcheck/callback`,
        payment_id: payment.id,
      }),
    });

    if (!pcheckResponse.ok) {
      const error = await pcheckResponse.json();
      console.error('P-Check request failed:', error);
      return NextResponse.json(
        { error: error?.error?.message || 'Failed to send request to P-Check' },
        { status: 500 }
      );
    }

    const data = await pcheckResponse.json();

    // Update payment with callback secret
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        callbackSecret: data.data?.attributes?.callback_secret,
      },
    });

    return NextResponse.json({
      success: true,
      requestId: data.data?.id || data.request_id,
      paymentId: payment.id,
      callbackSecret: data.data?.attributes?.callback_secret,
    });
  } catch (error) {
    console.error('P-Check request error:', error);
    return NextResponse.json(
      { error: 'Failed to create verification request' },
      { status: 500 }
    );
  }
}
