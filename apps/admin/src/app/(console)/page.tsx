import { Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import { getTranslations } from "next-intl/server";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const staff = await requireStaff();
  const t = await getTranslations("admin");
  const supabase = await createClient();

  const [{ data: branches }, { data: team }] = await Promise.all([
    supabase.from("branches").select("id, is_active"),
    supabase.rpc("list_staff"),
  ]);

  const stats = [
    { label: t("statBranches"), value: branches?.length ?? 0 },
    { label: t("statActiveBranches"), value: branches?.filter((b) => b.is_active).length ?? 0 },
    { label: t("statStaff"), value: new Set(team?.map((s) => s.user_id)).size },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("welcome", { name: staff.name })}</h1>
        <p className="text-muted-foreground">{t("dashboardIntro")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
