import type { Tables } from "@sarhad/core";
import { Redirect, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { AppText, Button, Card, Notice, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { SITE_URL, supabase } from "@/lib/supabase";
import { spacing } from "@/lib/theme";

type Profile = Pick<Tables<"profiles">, "full_name" | "phone">;

export default function Account() {
  const { t, locale } = useI18n();
  const { session, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [session]);

  if (!loading && !session) return <Redirect href="/sign-in" />;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  function openLegal(doc: "privacy" | "terms") {
    WebBrowser.openBrowserAsync(`${SITE_URL}${locale === "en" ? "/en" : ""}/${doc}`);
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      const code = ["staff_account", "open_orders"].includes(error.message)
        ? error.message
        : "unknown";
      setDeleteError(code);
      return;
    }
    // The user no longer exists; drop the local session too.
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/");
  }

  const rows: [string, string][] = [
    [t("auth.fullName"), profile?.full_name ?? "-"],
    [t("auth.email"), session?.user.email ?? "-"],
    [t("auth.phone"), profile?.phone ?? "-"],
  ];

  return (
    <Screen>
      <Title>{t("account.title")}</Title>
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("account.profile")}</AppText>
        {rows.map(([label, value]) => (
          <View key={label} style={{ gap: spacing.xs }}>
            <AppText muted style={{ fontSize: 13 }}>
              {label}
            </AppText>
            <AppText>{value}</AppText>
          </View>
        ))}
      </Card>
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("account.orders")}</AppText>
        <Button title={t("nav.orders")} variant="outline" onPress={() => router.push("/orders")} />
      </Card>
      <Button title={t("nav.signOut")} variant="outline" onPress={signOut} />
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("account.privacy")}</AppText>
        <Button
          title={t("legal.privacyTitle")}
          variant="outline"
          onPress={() => openLegal("privacy")}
        />
        <Button
          title={t("legal.termsTitle")}
          variant="outline"
          onPress={() => openLegal("terms")}
        />
        {confirming ? (
          <View style={{ gap: spacing.sm }}>
            <AppText style={{ fontWeight: "700" }}>{t("account.deleteTitle")}</AppText>
            <AppText muted>{t("account.deleteBody")}</AppText>
            <Button
              title={t("account.deleteForever")}
              variant="danger"
              loading={deleting}
              onPress={deleteAccount}
            />
            <Button
              title={t("account.keepAccount")}
              variant="outline"
              onPress={() => setConfirming(false)}
            />
          </View>
        ) : (
          <Button
            title={t("account.deleteAccount")}
            variant="outline"
            onPress={() => setConfirming(true)}
          />
        )}
        {deleteError ? (
          <Notice kind="error">{t(`account.deleteErrors.${deleteError}` as MessageKey)}</Notice>
        ) : null}
      </Card>
    </Screen>
  );
}
