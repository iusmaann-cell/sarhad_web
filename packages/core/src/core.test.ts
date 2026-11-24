import { describe, expect, it } from "vitest";

import {
  assignRoleSchema,
  canAccessBranch,
  canManageBranch,
  formatPrice,
  grantableRoles,
  kuwaitPhoneSchema,
  primaryRole,
  resetPasswordSchema,
  signUpSchema,
  type RoleAssignment,
} from "./index";

const B1 = "11111111-1111-4111-8111-111111111111";
const B2 = "22222222-2222-4222-8222-222222222222";

describe("roles", () => {
  const owner: RoleAssignment[] = [{ role: "owner", branch_id: null }];
  const admin: RoleAssignment[] = [{ role: "admin", branch_id: null }];
  const manager: RoleAssignment[] = [{ role: "branch_manager", branch_id: B1 }];
  const staff: RoleAssignment[] = [{ role: "staff", branch_id: B1 }];

  it("scopes branch roles to their branch", () => {
    expect(canAccessBranch(manager, B1)).toBe(true);
    expect(canAccessBranch(manager, B2)).toBe(false);
    expect(canAccessBranch(admin, B2)).toBe(true);
    expect(canManageBranch(staff, B1)).toBe(false);
    expect(canManageBranch(manager, B1)).toBe(true);
  });

  it("only owners can grant owner", () => {
    expect(grantableRoles(owner)).toContain("owner");
    expect(grantableRoles(admin)).not.toContain("owner");
    expect(grantableRoles(manager)).toEqual([]);
  });

  it("picks the highest role", () => {
    expect(primaryRole([...staff, ...admin])).toBe("admin");
    expect(primaryRole([])).toBeNull();
  });
});

describe("validation", () => {
  it("normalises Kuwait phone numbers", () => {
    expect(kuwaitPhoneSchema.parse("9999 1234")).toBe("+96599991234");
    expect(kuwaitPhoneSchema.parse("+965 5123-4567")).toBe("+96551234567");
    expect(kuwaitPhoneSchema.safeParse("12345678").success).toBe(false);
  });

  it("enforces the password rules", () => {
    const base = { fullName: "Ali", email: "ali@example.com" };
    expect(signUpSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "onlyletters" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "letters123" }).success).toBe(true);
  });

  it("requires matching passwords on reset", () => {
    const r = resetPasswordSchema.safeParse({ password: "abcd1234", confirmPassword: "abcd1235" });
    expect(r.success).toBe(false);
  });

  it("requires a branch for branch roles", () => {
    expect(assignRoleSchema.safeParse({ email: "a@b.co", role: "staff" }).success).toBe(false);
    expect(
      assignRoleSchema.safeParse({ email: "a@b.co", role: "staff", branchId: B1 }).success,
    ).toBe(true);
    expect(assignRoleSchema.safeParse({ email: "a@b.co", role: "admin" }).success).toBe(true);
  });
});

describe("formatPrice", () => {
  it("uses 3 decimals for KWD", () => {
    expect(formatPrice(1250, "en")).toContain("1.250");
  });
});
