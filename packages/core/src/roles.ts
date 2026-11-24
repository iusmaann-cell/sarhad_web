import type { Enums } from "./database.types";

export type AppRole = Enums<"app_role">;

export const APP_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "staff",
] as const satisfies readonly AppRole[];

/** Roles that apply to every branch. The others must be tied to one branch. */
export const GLOBAL_ROLES: readonly AppRole[] = ["owner", "admin"];

export type RoleAssignment = { role: AppRole; branch_id: string | null };

export function isGlobalRole(role: AppRole): boolean {
  return GLOBAL_ROLES.includes(role);
}

export function isAdmin(roles: readonly RoleAssignment[]): boolean {
  return roles.some((r) => isGlobalRole(r.role));
}

export function isOwner(roles: readonly RoleAssignment[]): boolean {
  return roles.some((r) => r.role === "owner");
}

/** Mirrors public.can_access_branch() in the database. */
export function canAccessBranch(roles: readonly RoleAssignment[], branchId: string): boolean {
  return isAdmin(roles) || roles.some((r) => r.branch_id === branchId);
}

/** Mirrors public.can_manage_branch() in the database. */
export function canManageBranch(roles: readonly RoleAssignment[], branchId: string): boolean {
  return (
    isAdmin(roles) || roles.some((r) => r.branch_id === branchId && r.role === "branch_manager")
  );
}

/** Which roles the signed-in user may hand out. Only owners create owners. */
export function grantableRoles(roles: readonly RoleAssignment[]): AppRole[] {
  if (isOwner(roles)) return [...APP_ROLES];
  if (isAdmin(roles)) return ["admin", "branch_manager", "staff"];
  return [];
}

/** The highest role, used for display. */
export function primaryRole(roles: readonly RoleAssignment[]): AppRole | null {
  for (const role of APP_ROLES) {
    if (roles.some((r) => r.role === role)) return role;
  }
  return null;
}
