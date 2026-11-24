import { formatPrice, type DeliveryMatch } from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AppText, Button, Card, Notice, Screen, Title } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";

type State =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "denied" }
  | { status: "error" }
  | { status: "done"; match: DeliveryMatch | null };

export default function DeliveryScreen() {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: "idle" });

  async function check() {
    setState({ status: "busy" });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setState({ status: "denied" });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { data, error } = await supabase.rpc("find_delivery_zone", {
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
      });
      if (error) throw error;
      setState({ status: "done", match: data?.[0] ?? null });
    } catch {
      setState({ status: "error" });
    }
  }

  const row = (label: string, value: string) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
      <AppText muted>{label}</AppText>
      <AppText style={{ fontWeight: "600" }}>{value}</AppText>
    </View>
  );

  return (
    <Screen>
      <Title>{t("delivery.title")}</Title>
      <AppText muted>{t("delivery.intro")}</AppText>
      <Button
        title={state.status === "busy" ? t("delivery.locating") : t("delivery.useMyLocation")}
        loading={state.status === "busy"}
        onPress={check}
      />

      {state.status === "denied" ? (
        <Notice kind="error">{t("delivery.locationDenied")}</Notice>
      ) : null}
      {state.status === "error" ? <Notice kind="error">{t("delivery.error")}</Notice> : null}

      {state.status === "done" && state.match ? (
        <Card>
          <AppText style={{ fontWeight: "700", fontSize: 17, color: theme.success }}>
            {t("delivery.yes", {
              zone: locale === "ar" ? state.match.zone_name_ar : state.match.zone_name_en,
            })}
          </AppText>
          <AppText muted>
            {t("delivery.fromBranch", {
              branch: localized(
                { name_en: state.match.branch_name_en, name_ar: state.match.branch_name_ar },
                "name",
                locale,
              ),
            })}
          </AppText>
          {row(
            t("delivery.fee"),
            state.match.fee_fils === 0
              ? t("delivery.free")
              : formatPrice(state.match.fee_fils, locale),
          )}
          {row(t("delivery.minOrder"), formatPrice(state.match.min_order_fils, locale))}
          {row(t("delivery.eta"), t("delivery.etaValue", { minutes: state.match.eta_minutes }))}
          <Button title={t("delivery.browseMenu")} onPress={() => router.push("/menu")} />
        </Card>
      ) : null}

      {state.status === "done" && !state.match ? (
        <Card>
          <AppText style={{ fontWeight: "700", fontSize: 17 }}>{t("delivery.no")}</AppText>
          <AppText muted>{t("delivery.noBody")}</AppText>
          <Button
            title={t("delivery.seeBranches")}
            variant="outline"
            onPress={() => router.push("/branches")}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
