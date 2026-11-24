import "server-only";

import { isAdmin, isOwner, primaryRole, type RoleAssignment } from "@sarhad/core";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "./supabase/server";

export type StaffContext = {
  userId: string;
  email: string;
  name: string;
  roles: RoleAssignment[];
  isAdmin: boolean;
  isOwner: boolean;
  primaryRole: NonNullable<ReturnType<typeof primaryRole>>;
};

/** Signed-in staff member for this request. Redirects if not allowed in. */
export const requireStaff = cache(async (): Promise<StaffContext> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.rpc("my_roles"),
    supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
  ]);

  const list = roles ?? [];
  const role = primaryRole(list);
  if (!role) redirect("/no-access");

  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    name: profile?.full_name || auth.user.email || "",
    roles: list,
    isAdmin: isAdmin(list),
    isOwner: isOwner(list),
    primaryRole: role,
  };
});
