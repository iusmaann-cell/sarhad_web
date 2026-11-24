import type { Tables } from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { AppText, Button, Card, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";

type Branch = Pick<
  Tables<"branches">,
  "id" | "name_en" | "name_ar" | "address_en" | "address_ar" | "phone"
>;

export default function Home() {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const theme = useTheme();
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from("branches")
      .select("id, name_en, name_ar, address_en, address_ar, phone")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setBranches(data ?? []));
  }, []);

  return (
    <Screen>
      <View style={{ gap: spacing.sm, paddingVertical: spacing.lg }}>
        <AppText style={{ color: theme.primary, fontWeight: "600" }}>
          {t("common.comingSoon")}
        </AppText>
        <Title>{t("home.heroTitle")}</Title>
        <AppText muted>{t("home.heroBody")}</AppText>
      </View>

      {session ? (
        <Button title={t("nav.account")} onPress={() => router.push("/account")} />
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Button title={t("nav.signIn")} onPress={() => router.push("/sign-in")} />
          <Button
            title={t("nav.signUp")}
            variant="outline"
            onPress={() => router.push("/sign-up")}
          />
        </View>
      )}

      <AppText style={{ fontSize: 20, fontWeight: "700", marginTop: spacing.md }}>
        {t("home.ourBranches")}
      </AppText>
      {branches.length === 0 ? (
        <AppText muted>{t("home.noBranches")}</AppText>
      ) : (
        branches.map((b) => (
          <Card key={b.id}>
            <AppText style={{ fontWeight: "700", fontSize: 17 }}>
              {localized(b, "name", locale)}
            </AppText>
            {localized(b, "address", locale) ? (
              <AppText muted>{localized(b, "address", locale)}</AppText>
            ) : null}
            {b.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${b.phone!.replace(/\s/g, "")}`)}>
                <AppText style={{ color: theme.primary }}>
                  {t("home.call")}: {b.phone}
                </AppText>
              </Pressable>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
