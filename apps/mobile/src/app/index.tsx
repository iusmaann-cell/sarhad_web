import { router } from "expo-router";
import { View } from "react-native";

import { AppText, Button, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { spacing, useTheme } from "@/lib/theme";

export default function Home() {
  const { t } = useI18n();
  const { session } = useAuth();
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ gap: spacing.sm, paddingVertical: spacing.lg }}>
        <AppText style={{ color: theme.primary, fontWeight: "600" }}>
          {t("menu.orderingSoon")}
        </AppText>
        <Title>{t("home.heroTitle")}</Title>
        <AppText muted>{t("home.heroBody")}</AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button title={t("menu.title")} onPress={() => router.push("/menu")} />
        <Button
          title={t("home.ourBranches")}
          variant="outline"
          onPress={() => router.push("/branches")}
        />
        <Button
          title={t("delivery.homeCta")}
          variant="outline"
          onPress={() => router.push("/delivery")}
        />
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {session ? (
          <Button
            title={t("nav.account")}
            variant="outline"
            onPress={() => router.push("/account")}
          />
        ) : (
          <>
            <Button
              title={t("nav.signIn")}
              variant="outline"
              onPress={() => router.push("/sign-in")}
            />
            <Button
              title={t("nav.signUp")}
              variant="link"
              onPress={() => router.push("/sign-up")}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
