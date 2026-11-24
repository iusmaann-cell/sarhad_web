"use server";

import { assignRoleSchema, fieldErrors } from "@sarhad/core";
import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/form-state";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

/** Map database errors to keys in the "admin" namespace. */
function dbErrorKey(error: { code?: string; message: string }): string {
  if (error.code === "P0002") return "noAccountForEmail";
  if (error.code === "P0001") return "lastOwner";
  if (error.code === "42501") {
    return error.message.toLowerCase().includes("owner")
      ? "onlyOwnerCanChangeOwners"
      : "notAllowed";
  }
  return "notAllowed";
}

export async function assignRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (!staff.isAdmin) return { status: "error", message: "notAllowed" };

  const raw = Object.fromEntries(formData);
  const values = {
    email: String(raw.email ?? ""),
    role: String(raw.role ?? ""),
    branchId: String(raw.branchId ?? ""),
  };
  const parsed = assignRoleSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

  const isGlobal = parsed.data.role === "owner" || parsed.data.role === "admin";
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_staff_role", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_branch_id: isGlobal ? null : (parsed.data.branchId ?? null),
  });
  if (error) return { status: "error", message: dbErrorKey(error), values };

  revalidatePath("/staff");
  return { status: "success", message: "roleAdded" };
}

export async function removeRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (!staff.isAdmin) return { status: "error", message: "notAllowed" };

  const roleId = String(formData.get("roleId") ?? "");
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("staff_roles")
    .delete({ count: "exact" })
    .eq("id", roleId);
  if (error) return { status: "error", message: dbErrorKey(error) };
  if (!count) return { status: "error", message: "notAllowed" };

  revalidatePath("/staff");
  return { status: "success", message: "roleRemoved" };
}
