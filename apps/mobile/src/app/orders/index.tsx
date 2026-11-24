import { formatPrice, type Tables } from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { AppText, Card, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

type Row = Pick<
  Tables<"orders">,
  "id" | "order_number" | "status" | "total_fils" | "created_at"
> & {
  branch: { name_en: string; name_ar: string } | null;
};

export default function OrdersScreen() {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const { session, loading } = useAuth();
  const [orders, setOrders] = useState<Row[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      supabase
        .from("orders")
        .select(
          "id, order_number, status, total_fils, created_at, branch:branches(name_en, name_ar)",
        )
        .order("created_at", { ascending: false })
        .limit(50)
        .then(({ data }) => setOrders((data ?? []) as unknown as Row[]));
    }, [session]),
  );

  if (!loading && !session) return <Redirect href="/sign-in" />;

  return (
    <Screen>
      <Title>{t("orders.title")}</Title>
      {orders === null ? <ActivityIndicator color={theme.primary} /> : null}
      {orders?.length === 0 ? <AppText muted>{t("orders.noOrders")}</AppText> : null}
      {orders?.map((o) => (
        <Pressable
          key={o.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/orders/[id]", params: { id: o.id } })}
        >
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText style={{ fontWeight: "700" }}>
                {t("orders.orderNumber", { number: o.order_number })}
              </AppText>
              <AppText style={{ fontWeight: "700" }}>{formatPrice(o.total_fils, locale)}</AppText>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText muted style={{ fontSize: 14 }}>
                {o.branch ? localized(o.branch, "name", locale) : ""}
              </AppText>
              <AppText
                style={{
                  fontSize: 14,
                  color: o.status === "cancelled" ? theme.muted : theme.primary,
                }}
              >
                {t(`orderStatus.${o.status}` as MessageKey)}
              </AppText>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
