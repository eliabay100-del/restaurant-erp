'use server';

import { prisma } from '@/lib/prisma';
import { authorize, FLOOR_ROLES, ALL_ROLES } from '@/lib/auth';
import { parseMoney, roundMoney } from '@/lib/money';
import type { Prisma, Payment } from '@prisma/client';
import { emitOutboundEvent } from '@/lib/integrations/outbox';
import { verifyPayment } from '@/lib/pcheck';
import { cookies } from 'next/headers';

const PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE', 'BANK_TRANSFER', 'OTHER'] as const;
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
    if (method === 'MOBILE' && (!reference || !reference.trim())) {
      return { success: false, error: 'Transaction reference is required for mobile payments' };
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

    const amountDue = roundMoney(order.total);

    if (order.payment) {
      // A zero-amount placeholder (e.g. P-Check verification) is completed, not duplicated.
      if (order.payment.amountPaid > 0) {
        return { success: false, error: 'This order has already been paid' };
      }
      if (tendered <= 0) {
        return { success: false, error: 'This order has already been paid' };
      }
      // Complete the existing placeholder payment instead of creating a new row.
      const completed = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.update({
          where: { id: order.payment!.id },
          data: {
            method: method as PaymentMethod,
            amountPaid: tendered,
            amountDue,
            changeGiven: method === 'CASH' ? roundMoney(tendered - amountDue) : 0,
            reference: reference ?? order.payment!.reference,
            verificationStatus: method === 'MOBILE' ? 'PENDING' : null,
          },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PAID', total: amountDue },
        });
        return p;
      });
      // Re-fetch full order
      const fullOrder2 = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, payment: true, staff: { select: { name: true, nameAm: true } } },
      });
      if (!fullOrder2) return { success: false, error: 'Order not found after payment' };
      await emitOutboundEvent(prisma, 'payment.completed', completed.id, {
        orderId, paymentId: completed.id, method, amountPaid: tendered, amountDue, changeGiven: completed.changeGiven, reference: reference ?? null, staffId: auth.session.staffId,
      });
      return { success: true, payment: completed, order: fullOrder2 };
    }

    // Cash tenders may exceed the total (change is returned); card/mobile must
    // cover the total. Never accept an underpayment that closes the order.
    if (tendered + 0.001 < amountDue) {
      return { success: false, error: 'Amount paid is less than the amount due' };
    }

    const changeGiven = method === 'CASH' ? roundMoney(tendered - amountDue) : 0;

    // Resolve the cashier's open shift (fallback to the order's shift).
    const cookieStore = await cookies();
    const shiftId = parseInt(cookieStore.get('shiftId')?.value || '0', 10) || order.shiftId || null;

    // P-Check: if a placeholder payment already exists and is VERIFIED, don't re-query.
    // (Handled above via the early-return path.)

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          orderId,
          method,
          amountPaid: tendered,
          amountDue,
          changeGiven,
          reference,
          receivedByStaffId: auth.session.staffId,
          shiftId,
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'PAID' },
      });
      return p;
    });

    // For mobile payments, verify with P-Check
    let verificationStatus: string | null = null;
    let verifiedAt: Date | null = null;
    
    if (method === 'MOBILE' && reference) {
      const verification = await verifyPayment(
        reference,
        'verify_et', // Default provider, could be auto-detected from reference
        tendered,
        'ETB'
      );
      
      verificationStatus = verification.status === 'verified' ? 'VERIFIED' : 
                          verification.status === 'declined' ? 'DECLINED' : 'PENDING';
      
      if (verification.status === 'verified') {
        verifiedAt = new Date();
      }
      
      // Update payment with verification status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          verificationStatus,
          verifiedAt,
        },
      });
    }

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
