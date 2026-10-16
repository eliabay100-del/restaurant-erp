import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { ALL_ROLES, MANAGEMENT_ROLES, FLOOR_ROLES, KITCHEN_ROLES, type Role } from '@/lib/roles';

// Re-export so existing server code can keep importing role groups from '@/lib/auth'.
export { ALL_ROLES, MANAGEMENT_ROLES, FLOOR_ROLES, KITCHEN_ROLES };
export type { Role };

export interface Session {
  staffId: number;
  name: string;
  role: Role;
}

/**
 * Read the currently authenticated staff member from the session cookie.
 * Returns null when there is no cookie, the cookie is malformed, or the
 * staff member no longer exists / has been deactivated.
 */
export async function getSession(): Promise<Session | null> {
  try {
    const store = await cookies();
    const raw = store.get('staffId')?.value;
    const staffId = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(staffId)) return null;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, role: true, isActive: true },
    });

    if (!staff || !staff.isActive) return null;

    return { staffId: staff.id, name: staff.name, role: staff.role as Role };
  } catch {
    return null;
  }
}

export type GuardResult =
  | { ok: true; session: Session }
  | { ok: false; error: string };

/**
 * Authorization helper used at the top of every server action.
 *
 *   const auth = await authorize(MANAGEMENT_ROLES);
 *   if (!auth.ok) return { success: false, error: auth.error };
 *
 * Pass no roles to require only a valid session.
 */
export async function authorize(roles?: Role[]): Promise<GuardResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };
  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    return { ok: false, error: 'Not authorized for this action' };
  }
  return { ok: true, session };
}
