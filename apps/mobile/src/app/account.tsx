import type { Tables } from "@sarhad/core";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { AppText, Button, Card, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { spacing } from "@/lib/theme";

type Profile = Pick<Tables<"profiles">, "full_name" | "phone">;

export default function Account() {
  const { t } = useI18n();
  const { session, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

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
        <AppText muted>{t("account.noOrders")}</AppText>
      </Card>
      <Button title={t("nav.signOut")} variant="outline" onPress={signOut} />
    </Screen>
  );
}
