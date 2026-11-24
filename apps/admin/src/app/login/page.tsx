import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/forms";
import { safeNext } from "@/lib/form-state";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const t = await getTranslations("admin");
  return (
    <AuthShell title={t("signInTitle")}>
      <SignInForm
        next={safeNext(typeof sp.next === "string" ? sp.next : undefined, "/")}
        linkError={sp.error === "link"}
      />
    </AuthShell>
  );
}
