import { Button } from "@sarhad/ui";
import { getTranslations } from "next-intl/server";

import { signOut } from "@/app/actions";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function NoAccessPage() {
  const t = await getTranslations("admin");
  const tn = await getTranslations("nav");
  return (
    <AuthShell title={t("notStaffTitle")} description={t("notStaffBody")}>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          {tn("signOut")}
        </Button>
      </form>
    </AuthShell>
  );
}
