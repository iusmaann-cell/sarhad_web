import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleToggle } from "../locale-toggle";
import { AuthCard } from "./auth-card";

export async function AuthShell(props: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const tc = await getTranslations("common");
  const t = await getTranslations("admin");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-bold text-primary">
          {tc("brand")} · {t("title")}
        </span>
        <LocaleToggle />
      </header>
      <main className="flex-1">
        <AuthCard {...props} />
      </main>
    </div>
  );
}
