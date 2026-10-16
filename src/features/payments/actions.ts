'use server';

import { prisma } from '@/lib/prisma';
import { authorize, FLOOR_ROLES, ALL_ROLES } from '@/lib/auth';
import { parseMoney, roundMoney } from '@/lib/money';
import type { Prisma, Payment } from '@prisma/client';
import { emitOutboundEvent } from '@/lib/integrations/outbox';

const PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

type ProcessedOrder = Prisma.OrderGetPayload<{
  include: {
    items: true;
    payment: true;
    staff: { select: { name: true; nameAm: true } };
  };
}>;

export type ProcessPaymentResult =
  | { success: true; payment: Payment; order: ProcessedOrder }
  | { success: false; error: string };

export async function processPayment(
  orderId: number,
  method: string,
  amountPaid: number,
  reference?: string
): Promise<ProcessPaymentResult> {
  try {
    const auth = await authorize(FLOOR_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (!PAYMENT_METHODS.includes(method as PaymentMethod)) {
      return { success: false, error: 'Invalid payment method' };
    }
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return { success: false, error: 'Invalid order' };
    }

    const tendered = parseMoney(amountPaid);
    if (tendered === null || tendered < 0) {
      return { success: false, error: 'Invalid payment amount' };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }
    if (order.status === 'CANCELLED') {
      return { success: false, error: 'Cannot pay a cancelled order' };
    }
    if (order.payment) {
      return { success: false, error: 'This order has already been paid' };
    }

    // Cash tenders may exceed the total (change is returned); card/mobile must
    // cover the total. Never accept an underpayment that closes the order.
    const amountDue = roundMoney(order.total);
    if (tendered + 0.001 < amountDue) {
      return { success: false, error: 'Amount paid is less than the amount due' };
    }

    const changeGiven = method === 'CASH' ? roundMoney(tendered - amountDue) : 0;

    const payment = await prisma.payment.create({
      data: {
        orderId,
        method,
        amountPaid: tendered,
        amountDue,
        changeGiven,
        reference,
      },
    });

    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true,
        staff: { select: { name: true, nameAm: true } },
      },
    });

    if (!fullOrder) {
      return { success: false, error: 'Order not found after payment' };
    }

    await emitOutboundEvent(prisma, 'payment.completed', payment.id, {
      orderId,
      paymentId: payment.id,
      method,
      amountPaid: tendered,
      amountDue,
      changeGiven,
      reference: reference ?? null,
      verifiedAt: new Date().toISOString(),
      staffId: auth.session.staffId,
    });

    return { success: true, payment, order: fullOrder };
  } catch (error) {
    console.error('Process payment error:', error);
    return { success: false, error: 'Failed to process payment' };
  }
}

export async function getPaymentByOrder(orderId: number) {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const payment = await prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            items: true,
            staff: { select: { name: true, nameAm: true } },
          },
        },
      },
    });

    return { success: true, payment };
  } catch (error) {
    console.error('Get payment error:', error);
    return { success: false, error: 'Failed to fetch payment' };
  }
}
