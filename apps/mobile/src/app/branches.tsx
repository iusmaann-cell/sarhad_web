import { isOpenAt, WEEK_DAYS } from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import { Linking, View } from "react-native";

import { AppText, Button, Card, Screen, Title } from "@/components/ui";
import { useBranches } from "@/lib/branches";
import { useI18n } from "@/lib/i18n";
import { spacing, useTheme } from "@/lib/theme";

export default function BranchesScreen() {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const { branches, loading } = useBranches();
  const now = new Date();

  return (
    <Screen>
      <Title>{t("branchesPage.title")}</Title>
      {!loading && branches.length === 0 ? <AppText muted>{t("home.noBranches")}</AppText> : null}
      {branches.map((b) => {
        const open = isOpenAt(b.opening_hours, now, b.timezone);
        return (
          <Card key={b.id}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <AppText style={{ fontWeight: "700", fontSize: 17 }}>
                {localized(b, "name", locale)}
              </AppText>
              <AppText
                style={{
                  color: open ? theme.success : theme.muted,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {open ? t("common.openNow") : t("common.closedNow")}
              </AppText>
            </View>
            {localized(b, "address", locale) ? (
              <AppText muted>{localized(b, "address", locale)}</AppText>
            ) : null}
            <AppText style={{ fontWeight: "600", marginTop: spacing.sm }}>
              {t("branchesPage.hours")}
            </AppText>
            {WEEK_DAYS.map((d) => {
              const ranges = b.opening_hours[d] ?? [];
              return (
                <View key={d} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText muted style={{ fontSize: 14 }}>
                    {t(`days.${d}`)}
                  </AppText>
                  <AppText muted style={{ fontSize: 14 }}>
                    {ranges.length
                      ? ranges.map((r) => `${r.open}–${r.close}`).join(", ")
                      : t("common.closed")}
                  </AppText>
                </View>
              );
            })}
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {b.phone ? (
                <Button
                  title={`${t("home.call")} ${b.phone}`}
                  variant="outline"
                  onPress={() => Linking.openURL(`tel:${b.phone!.replace(/\s/g, "")}`)}
                />
              ) : null}
              {b.latitude !== null && b.longitude !== null ? (
                <Button
                  title={t("branchesPage.directions")}
                  variant="outline"
                  onPress={() =>
                    Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`,
                    )
                  }
                />
              ) : null}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
