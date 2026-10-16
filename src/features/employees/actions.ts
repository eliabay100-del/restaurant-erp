'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { authorize, MANAGEMENT_ROLES } from '@/lib/auth';
import { parseMoney, roundMoney } from '@/lib/money';

export async function getEmployees() {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, employees: [] };

    const staff = await prisma.staff.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        salaryPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { shifts: true, orders: true } },
      },
    });
    return { success: true, employees: staff };
  } catch (error) {
    console.error('Get employees error:', error);
    return { success: false, error: 'Failed to fetch employees', employees: [] };
  }
}

export async function createEmployee(data: {
  name: string;
  nameAm?: string;
  pin: string;
  role: string;
  phone?: string;
  salary?: number;
  bankName?: string;
  bankAccount?: string;
}) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const pinHash = await bcrypt.hash(data.pin, 10);
    const employee = await prisma.staff.create({
      data: {
        name: data.name,
        nameAm: data.nameAm,
        pinHash,
        role: data.role,
        phone: data.phone,
        salary: data.salary || 0,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
      },
    });
    return { success: true, employee };
  } catch (error) {
    console.error('Create employee error:', error);
    return { success: false, error: 'Failed to create employee' };
  }
}

export async function updateEmployee(
  id: number,
  data: {
    name?: string;
    nameAm?: string;
    role?: string;
    phone?: string;
    salary?: number;
    isActive?: boolean;
    pin?: string;
  }
) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.nameAm !== undefined) updateData.nameAm = data.nameAm;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.salary !== undefined) updateData.salary = data.salary;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.pin) updateData.pinHash = await bcrypt.hash(data.pin, 10);

    const employee = await prisma.staff.update({ where: { id }, data: updateData });
    return { success: true, employee };
  } catch (error) {
    console.error('Update employee error:', error);
    return { success: false, error: 'Failed to update employee' };
  }
}

export async function paySalary(data: {
  staffId: number;
  amount: number;
  bonus?: number;
  deductions?: number;
  absentDays?: number;
  month: string;
  note?: string;
}) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    if (!Number.isInteger(data.staffId) || data.staffId <= 0) {
      return { success: false, error: 'Invalid staff member' };
    }
    if (!/^\d{4}-\d{2}$/.test(String(data.month ?? ''))) {
      return { success: false, error: 'Month must be in YYYY-MM format' };
    }

    const amount = parseMoney(data.amount);
    if (amount === null || amount <= 0) {
      return { success: false, error: 'Salary amount must be greater than zero' };
    }

    const bonus = Math.max(parseMoney(data.bonus) ?? 0, 0);
    const deductions = Math.max(parseMoney(data.deductions) ?? 0, 0);
    const absentDays = Math.max(Math.floor(data.absentDays || 0), 0);

    // Guard against paying the same person twice for the same month.
    const alreadyPaid = await prisma.salaryPayment.findFirst({
      where: { staffId: data.staffId, month: data.month, status: 'PAID' },
      select: { id: true },
    });
    if (alreadyPaid) {
      return { success: false, error: `Salary for ${data.month} has already been paid` };
    }

    const dailyRate = roundMoney(amount / 30);
    const absentDeduction = roundMoney(dailyRate * absentDays);
    const totalDeductions = roundMoney(deductions + absentDeduction);
    const netPay = roundMoney(amount + bonus - totalDeductions);

    const payment = await prisma.salaryPayment.create({
      data: {
        staffId: data.staffId,
        amount,
        bonus,
        deductions: totalDeductions,
        absentDays,
        dailyRate,
        netPay,
        month: data.month,
        status: 'PAID',
        paidAt: new Date(),
        note: data.note,
      },
    });
    return { success: true, payment };
  } catch (error) {
    console.error('Pay salary error:', error);
    return { success: false, error: 'Failed to process salary payment' };
  }
}

export async function getSalaryHistory(staffId?: number) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error, payments: [] };

    const where = staffId ? { staffId } : {};
    const payments = await prisma.salaryPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        staff: { select: { name: true, nameAm: true, role: true } },
      },
    });
    return { success: true, payments };
  } catch (error) {
    console.error('Get salary history error:', error);
    return { success: false, error: 'Failed to fetch salary history', payments: [] };
  }
}

export async function deleteEmployee(id: number) {
  try {
    const auth = await authorize(MANAGEMENT_ROLES);
    if (!auth.ok) return { success: false, error: auth.error };

    // Check if staff has orders
    const orderCount = await prisma.order.count({ where: { staffId: id } });
    if (orderCount > 0) {
      return { success: false, error: 'Cannot delete employee with order history. Please deactivate them instead.' };
    }

    // Delete related records that don't affect financial totals
    await prisma.shift.deleteMany({ where: { staffId: id } });
    await prisma.salaryPayment.deleteMany({ where: { staffId: id } });
    await prisma.auditLog.deleteMany({ where: { staffId: id } });

    await prisma.staff.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    console.error('Delete employee error:', error);
    return { success: false, error: 'Failed to delete employee' };
  }
}
