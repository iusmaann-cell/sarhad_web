import { Button } from "@sarhad/ui";
import { getTranslations } from "next-intl/server";

import { signOut } from "@/app/actions";
import { ConsoleNav } from "@/components/console-nav";
import { LocaleToggle } from "@/components/locale-toggle";
import { requireStaff } from "@/lib/staff";

export default async function ConsoleLayout({ children }: LayoutProps<"/">) {
  const staff = await requireStaff();
  const [t, tc, tn] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getTranslations("nav"),
  ]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col gap-6 border-b bg-card p-4 md:w-64 md:border-b-0 md:border-e">
        <div>
          <p className="text-lg font-bold text-primary">{tc("brand")}</p>
          <p className="text-xs text-muted-foreground">{t("title")}</p>
        </div>
        <ConsoleNav isAdmin={staff.isAdmin} />
        <div className="mt-auto grid gap-2 border-t pt-4 text-sm">
          <div>
            <p className="font-medium">{staff.name}</p>
            <p className="text-xs text-muted-foreground">{t(`roles.${staff.primaryRole}`)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LocaleToggle />
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                {tn("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
