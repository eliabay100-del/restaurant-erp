'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { authorize, ALL_ROLES, MANAGEMENT_ROLES } from '@/lib/auth';

// ---- Login throttling -------------------------------------------------------
// Simple in-process limiter. Adequate for a single-terminal LAN deployment;
// swap for a shared store (Redis/DB) if the app is ever horizontally scaled.
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 60_000;
const LOCKOUT_MS = 60_000;

type AttemptRecord = { count: number; firstAt: number; lockedUntil: number };
const pinAttempts = new Map<string, AttemptRecord>();

async function attemptKey(): Promise<string> {
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
    return ip;
  } catch {
    return 'local';
  }
}

export async function verifyPin(pin: string) {
  try {
    const key = await attemptKey();
    const now = Date.now();

    const record = pinAttempts.get(key);
    if (record && record.lockedUntil > now) {
      const secs = Math.ceil((record.lockedUntil - now) / 1000);
      return { success: false, error: `Too many attempts. Try again in ${secs}s` };
    }

    const allStaff = await prisma.staff.findMany({
      where: { isActive: true },
    });

    for (const staff of allStaff) {
      const isValid = await bcrypt.compare(pin, staff.pinHash);
      if (isValid) {
        pinAttempts.delete(key);

        // Set session cookies
        const cookieStore = await cookies();
        cookieStore.set('staffId', String(staff.id), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 12, // 12 hours
          path: '/',
        });
        cookieStore.set('staffRole', staff.role, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 12,
          path: '/',
        });

        return {
          success: true,
          staff: {
            id: staff.id,
            name: staff.name,
            nameAm: staff.nameAm,
            role: staff.role,
          },
        };
      }
    }

    // Record the failed attempt and lock out once the threshold is hit.
    const fresh = !record || now - record.firstAt > ATTEMPT_WINDOW_MS;
    const next: AttemptRecord = fresh
      ? { count: 1, firstAt: now, lockedUntil: 0 }
      : { count: record.count + 1, firstAt: record.firstAt, lockedUntil: 0 };
    if (next.count >= MAX_ATTEMPTS) {
      next.lockedUntil = now + LOCKOUT_MS;
      next.count = 0;
      next.firstAt = now;
    }
    pinAttempts.set(key, next);

    return { success: false, error: 'Invalid PIN' };
  } catch (error) {
    console.error('PIN verification error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('staffId');
  cookieStore.delete('staffRole');
  cookieStore.delete('shiftId');
  return { success: true };
}

export async function startShift(staffId: number, openingCash: number) {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    // Check if there's already an open shift for this staff — resume it
    const existingShift = await prisma.shift.findFirst({
      where: { staffId, status: 'OPEN' },
      orderBy: { startTime: 'desc' },
    });

    if (existingShift) {
      // Resume the existing open shift instead of creating a new one
      const cookieStore = await cookies();
      cookieStore.set('shiftId', String(existingShift.id), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 12,
        path: '/',
      });

      return {
        success: true,
        resumed: true,
        shift: {
          id: existingShift.id,
          startTime: existingShift.startTime.toISOString(),
          openingCash: existingShift.openingCash,
          status: existingShift.status,
        },
      };
    }
    
    // Ensure no OTHER cashier has an open shift (only one active cashier shift allowed at a time)
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (staff?.role === 'CASHIER') {
      const otherOpenShift = await prisma.shift.findFirst({
        where: {
          status: 'OPEN',
          staff: { role: 'CASHIER' }
        },
        include: { staff: true }
      });
      
      if (otherOpenShift) {
        return { 
          success: false, 
          error: `Cannot open shift. ${otherOpenShift.staff.name} is currently open. Please have them end their shift first.` 
        };
      }
    }

    // No open shift — create a new one
    const shift = await prisma.shift.create({
      data: {
        staffId,
        openingCash,
        status: 'OPEN',
      },
    });

    // Set shift cookie
    const cookieStore = await cookies();
    cookieStore.set('shiftId', String(shift.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 12,
      path: '/',
    });

    return {
      success: true,
      resumed: false,
      shift: {
        id: shift.id,
        startTime: shift.startTime.toISOString(),
        openingCash: shift.openingCash,
        status: shift.status,
      },
    };
  } catch (error) {
    console.error('Start shift error:', error);
    return { success: false, error: 'Failed to start shift' };
  }
}

export async function endShift(shiftId: number, closingCash: number, notes?: string) {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    // Calculate expected cash from cash payments in this shift
    const cashPayments = await prisma.payment.findMany({
      where: {
        order: { shiftId, status: { not: 'CANCELLED' } },
        method: 'CASH',
      },
    });

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      return { success: false, error: 'Shift not found' };
    }

    const cashReceived = cashPayments.reduce((sum, p) => sum + p.amountPaid - p.changeGiven, 0);
    const expectedCash = shift.openingCash + cashReceived;

    // Get order stats for the shift
    const orders = await prisma.order.findMany({
      where: { shiftId, status: { not: 'CANCELLED' } },
      include: { payment: true },
    });

    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = orders.length;

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        endTime: new Date(),
        closingCash,
        expectedCash,
        status: 'PENDING_APPROVAL',
        notes,
      },
    });

    // Log the shift end
    await prisma.auditLog.create({
      data: {
        staffId: shift.staffId,
        action: 'SHIFT_CLOSE',
        details: JSON.stringify({
          shiftId,
          openingCash: shift.openingCash,
          closingCash,
          expectedCash,
          difference: closingCash - expectedCash,
          totalSales,
          orderCount,
        }),
      },
    });

    return {
      success: true,
      shift: {
        id: updatedShift.id,
        startTime: updatedShift.startTime.toISOString(),
        endTime: updatedShift.endTime?.toISOString(),
        openingCash: updatedShift.openingCash,
        closingCash: updatedShift.closingCash,
        expectedCash: updatedShift.expectedCash,
        difference: closingCash - expectedCash,
        status: updatedShift.status,
        totalSales,
        orderCount,
      },
    };
  } catch (error) {
    console.error('End shift error:', error);
    return { success: false, error: 'Failed to end shift' };
  }
}

export async function approveShift(shiftId: number, approvedById: number) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (!Number.isInteger(approvedById) || approvedById <= 0) {
      return { success: false, error: 'Invalid reviewer' };
    }

    const [shift] = await prisma.$transaction([
      prisma.shift.update({
        where: { id: shiftId },
        data: {
          status: 'APPROVED',
          approvedById,
        },
      }),
      prisma.auditLog.create({
        data: {
          staffId: approvedById,
          action: 'SHIFT_APPROVE',
          details: JSON.stringify({ shiftId }),
        },
      }),
    ]);

    return { success: true, shift };
  } catch (error) {
    console.error('Approve shift error:', error);
    return { success: false, error: 'Failed to approve shift' };
  }
}

export async function rejectShift(shiftId: number, rejectedById: number) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (!Number.isInteger(rejectedById) || rejectedById <= 0) {
      return { success: false, error: 'Invalid reviewer' };
    }

    // Rejecting a close-review reopens the shift so the cashier can recount.
    // Both writes succeed or fail together.
    const [shift] = await prisma.$transaction([
      prisma.shift.update({
        where: { id: shiftId },
        data: {
          status: 'OPEN',
          approvedById: rejectedById,
          closingCash: null,
          expectedCash: null,
          endTime: null,
        },
      }),
      prisma.auditLog.create({
        data: {
          staffId: rejectedById,
          action: 'SHIFT_REJECT',
          details: JSON.stringify({ shiftId }),
        },
      }),
    ]);

    return { success: true, shift };
  } catch (error) {
    console.error('Reject shift error:', error);
    return { success: false, error: 'Failed to reject shift' };
  }
}

export async function getCurrentStaff() {
  try {
    const cookieStore = await cookies();
    const staffIdCookie = cookieStore.get('staffId');
    if (!staffIdCookie) return null;

    const staffId = Number.parseInt(staffIdCookie.value, 10);
    if (!Number.isFinite(staffId)) return null;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, nameAm: true, role: true, isActive: true },
    });

    if (!staff || !staff.isActive) return null;

    return { id: staff.id, name: staff.name, nameAm: staff.nameAm, role: staff.role };
  } catch {
    return null;
  }
}

export async function getActiveShift(staffId: number) {
  try {
    const auth = await authorize(ALL_ROLES);
    if (!auth.ok) return null;

    const shift = await prisma.shift.findFirst({
      where: { staffId, status: 'OPEN' },
      orderBy: { startTime: 'desc' },
    });

    if (!shift) return null;

    return {
      id: shift.id,
      startTime: shift.startTime.toISOString(),
      openingCash: shift.openingCash,
      status: shift.status,
    };
  } catch {
    return null;
  }
}
