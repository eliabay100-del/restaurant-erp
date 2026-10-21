import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const orderId = parseInt((await params).orderId);
    
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      select: {
        verificationStatus: true,
        reference: true,
        verifiedAt: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      verificationStatus: payment.verificationStatus,
      reference: payment.reference,
      verifiedAt: payment.verifiedAt,
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
}
