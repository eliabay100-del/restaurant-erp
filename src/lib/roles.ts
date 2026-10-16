/**
 * Role definitions and access rules.
 *
 * This module is intentionally free of any server-only imports so it can be
 * used from both server actions (`@/lib/auth`) and client components
 * (navigation, route guards).
 */

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER';

export const ALL_ROLES: Role[] = ['ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER'];
export const MANAGEMENT_ROLES: Role[] = ['ADMIN', 'MANAGER'];
export const FLOOR_ROLES: Role[] = ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER'];
export const KITCHEN_ROLES: Role[] = ['ADMIN', 'MANAGER', 'KITCHEN'];

export function hasRole(role: string | null | undefined, allowed: readonly Role[]): boolean {
  if (!role) return false;
  return (allowed as readonly string[]).includes(role.toUpperCase());
}

export interface NavPermission {
  /** Dashboard path, without the locale prefix. */
  path: string;
  roles: Role[];
}

/** Which dashboard sections each role may open. */
export const DASHBOARD_ACCESS: NavPermission[] = [
  { path: '/overview', roles: MANAGEMENT_ROLES },
  { path: '/orders', roles: FLOOR_ROLES },
  { path: '/menu', roles: MANAGEMENT_ROLES },
  { path: '/shifts', roles: MANAGEMENT_ROLES },
  { path: '/employees', roles: MANAGEMENT_ROLES },
  { path: '/inventory', roles: MANAGEMENT_ROLES },
  { path: '/reports', roles: MANAGEMENT_ROLES },
];

/** Paths that are part of the dashboard but are not enumerated above. */
export function canAccessPath(role: string | null | undefined, path: string): boolean {
  const entry = DASHBOARD_ACCESS.find((e) => path === e.path || path.startsWith(`${e.path}/`));
  if (!entry) return true; // unknown dashboard path: do not block
  return hasRole(role, entry.roles);
}

/** Which stand-alone POS screens each role may open. */
export const POS_ACCESS = {
  cashier: FLOOR_ROLES,
  kitchen: KITCHEN_ROLES,
} as const;

export function canAccessPos(role: string | null | undefined, screen: keyof typeof POS_ACCESS): boolean {
  return hasRole(role, POS_ACCESS[screen]);
}
