import { grantableRoles } from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sarhad/ui";
import { getLocale, getTranslations } from "next-intl/server";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { AddStaffForm, RemoveRoleButton } from "./staff-forms";

export default async function StaffPage() {
  const staff = await requireStaff();
  const [t, tc, locale] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getLocale(),
  ]);
  const supabase = await createClient();
  const [{ data: team }, { data: branches }] = await Promise.all([
    supabase.rpc("list_staff"),
    supabase.from("branches").select("id, name_en, name_ar").order("sort_order"),
  ]);

  const branchName = new Map((branches ?? []).map((b) => [b.id, localized(b, "name", locale)]));
  const roles = grantableRoles(staff.roles);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("staff")}</h1>

      {staff.isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("addStaff")}</CardTitle>
            <CardDescription>{t("addStaffHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AddStaffForm
              roles={roles}
              branches={[...branchName].map(([id, name]) => ({ id, name }))}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-medium">{t("staffName")}</th>
              <th className="p-3 text-start font-medium">{t("staffEmail")}</th>
              <th className="p-3 text-start font-medium">{t("staffRole")}</th>
              <th className="p-3 text-start font-medium">{t("staffBranch")}</th>
              {staff.isAdmin ? <th className="p-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {(team ?? []).map((m) => (
              <tr key={m.role_id} className="border-b last:border-0">
                <td className="p-3 font-medium">{m.full_name ?? "-"}</td>
                <td className="p-3" dir="ltr">
                  {m.email}
                </td>
                <td className="p-3">{t(`roles.${m.role}`)}</td>
                <td className="p-3">
                  {m.branch_id ? branchName.get(m.branch_id) : tc("allBranches")}
                </td>
                {staff.isAdmin ? (
                  <td className="p-3 text-end">
                    {m.role !== "owner" || staff.isOwner ? (
                      <RemoveRoleButton roleId={m.role_id} />
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
