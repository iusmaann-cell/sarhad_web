import { localized } from "@sarhad/i18n";
import { Badge, Card } from "@sarhad/ui";
import { getLocale, getTranslations } from "next-intl/server";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export default async function BranchesPage() {
  await requireStaff();
  const [t, tc, th, locale] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getTranslations("home"),
    getLocale(),
  ]);
  const supabase = await createClient();
  // RLS returns only the branches this staff member may see.
  const { data: branches } = await supabase
    .from("branches")
    .select("id, slug, name_en, name_ar, phone, is_active, accepts_delivery, accepts_pickup")
    .order("sort_order");

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("branches")}</h1>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-medium">{t("branchName")}</th>
              <th className="p-3 text-start font-medium">{t("branchPhone")}</th>
              <th className="p-3 text-start font-medium">{t("branchServices")}</th>
              <th className="p-3 text-start font-medium">{t("branchStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {(branches ?? []).map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{localized(b, "name", locale)}</td>
                <td className="p-3" dir="ltr">
                  {b.phone ?? "-"}
                </td>
                <td className="flex gap-1 p-3">
                  {b.accepts_delivery ? <Badge variant="success">{th("delivery")}</Badge> : null}
                  {b.accepts_pickup ? <Badge variant="secondary">{th("pickup")}</Badge> : null}
                </td>
                <td className="p-3">
                  <Badge variant={b.is_active ? "success" : "muted"}>
                    {b.is_active ? tc("active") : tc("inactive")}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
