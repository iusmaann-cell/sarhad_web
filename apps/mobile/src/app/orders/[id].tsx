import {
  formatAddress,
  formatPrice,
  isOpenOrder,
  orderSteps,
  type OrderAddress,
  type Tables,
} from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, View } from "react-native";

import { AppText, Button, Card, Notice, Screen, Title } from "@/components/ui";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";

type Order = Omit<Tables<"orders">, "address"> & {
  address: OrderAddress | null;
  items: (Omit<Tables<"order_items">, "options"> & {
    options: { name_en: string; name_ar: string }[];
  })[];
  branch: { name_en: string; name_ar: string; phone: string | null } | null;
};

export default function OrderScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const { t, locale } = useI18n();
  const theme = useTheme();
  const [order, setOrder] = useState<Order | null>(null);
  const [cancelFailed, setCancelFailed] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, items:order_items(*), branch:branches(name_en, name_ar, phone)")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const o = data as unknown as Order;
      o.items.sort((a, b) => a.sort_order - b.sort_order);
      setOrder(o);
    }
  }, [id]);

  // Load now, then every 15 seconds while the order is in progress.
  const active = order ? isOpenOrder(order.status) : true;
  useEffect(() => {
    // Fetching on mount and on a timer is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    if (!active) return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load, active]);

  if (!order) {
    return (
      <Screen>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }

  const steps = orderSteps(order.type);
  const current = steps.indexOf(order.status);

  function cancel() {
    Alert.alert(t("orders.confirmCancel"), "", [
      { text: t("common.no"), style: "cancel" },
      {
        text: t("common.yes"),
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.rpc("cancel_my_order", { p_order_id: order!.id });
          setCancelFailed(!!error);
          load();
        },
      },
    ]);
  }

  return (
    <Screen>
      {placed ? <Notice kind="success">{t("orders.thanks")}</Notice> : null}
      <Title>{t("orders.orderNumber", { number: order.order_number })}</Title>
      {order.status === "cancelled" ? (
        <Notice kind="error">
          {t("orders.cancelled")}
          {order.cancel_reason && order.cancel_reason !== "customer"
            ? ` ${t("orders.cancelReason", { reason: order.cancel_reason })}`
            : ""}
        </Notice>
      ) : (
        <Card>
          {steps.map((s, i) => {
            const done = i < current || order.status === "completed";
            const now = i === current && order.status !== "completed";
            return (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <AppText style={{ color: done || now ? theme.primary : theme.muted, fontSize: 18 }}>
                  {done ? "●" : now ? "◉" : "○"}
                </AppText>
                <AppText
                  style={{
                    fontWeight: now ? "700" : "400",
                    color: done || now ? theme.text : theme.muted,
                  }}
                >
                  {t(`orderStatus.${s}` as MessageKey)}
                </AppText>
              </View>
            );
          })}
          {order.type === "delivery" && order.eta_minutes && active ? (
            <AppText muted style={{ fontSize: 14 }}>
              {t("orders.eta", { minutes: order.eta_minutes })}
            </AppText>
          ) : null}
        </Card>
      )}

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("orders.items")}</AppText>
        {order.items.map((i) => (
          <View
            key={i.id}
            style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}
          >
            <View style={{ flex: 1 }}>
              <AppText>
                {i.quantity} × {localized(i, "name", locale)}
              </AppText>
              {i.options.length ? (
                <AppText muted style={{ fontSize: 13 }}>
                  {i.options.map((o) => localized(o, "name", locale)).join("، ")}
                </AppText>
              ) : null}
            </View>
            <AppText>{formatPrice(i.line_total_fils, locale)}</AppText>
          </View>
        ))}
        {order.type === "delivery" ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText>{t("checkout.deliveryFee")}</AppText>
            <AppText>
              {order.delivery_fee_fils === 0
                ? t("checkout.free")
                : formatPrice(order.delivery_fee_fils, locale)}
            </AppText>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <AppText style={{ fontWeight: "700" }}>{t("checkout.total")}</AppText>
          <AppText style={{ fontWeight: "700" }}>{formatPrice(order.total_fils, locale)}</AppText>
        </View>
        <AppText>{t("orders.payCash", { total: formatPrice(order.total_fils, locale) })}</AppText>
      </Card>

      <Card>
        <AppText style={{ fontWeight: "700" }}>
          {order.type === "delivery" ? t("orders.deliverTo") : t("orders.pickupAt")}
        </AppText>
        <AppText>
          {order.type === "delivery"
            ? formatAddress(order.address, {
                block: t("checkout.block"),
                street: t("checkout.street"),
                avenue: t("checkout.avenue"),
                building: t("checkout.building"),
                floor: t("checkout.floor"),
                apartment: t("checkout.apartment"),
              })
            : order.branch
              ? localized(order.branch, "name", locale)
              : ""}
        </AppText>
        {order.branch?.phone ? (
          <Button
            title={t("orders.callBranch")}
            variant="outline"
            onPress={() => Linking.openURL(`tel:${order.branch!.phone!.replace(/\s/g, "")}`)}
          />
        ) : null}
        {order.status === "pending" ? (
          <Button title={t("orders.cancel")} variant="outline" onPress={cancel} />
        ) : null}
        {cancelFailed ? (
          <AppText style={{ color: theme.danger }}>{t("orders.cannotCancel")}</AppText>
        ) : null}
      </Card>
    </Screen>
  );
}
