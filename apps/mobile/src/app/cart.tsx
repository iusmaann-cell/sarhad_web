import { cartSubtotal, formatPrice } from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Stepper } from "@/components/stepper";
import { AppText, Button, Card, Notice, Screen, Title } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { useFreshCart } from "@/lib/fresh-cart";
import { useI18n } from "@/lib/i18n";
import { spacing, useTheme } from "@/lib/theme";

export default function CartScreen() {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const { setQuantity } = useCart();
  const { cart, branch, removed, checked } = useFreshCart();

  if (!checked) {
    return (
      <Screen>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t("cart.title")}</Title>
      {removed > 0 ? <Notice kind="error">{t("checkout.errors.item_unavailable")}</Notice> : null}
      {cart.lines.length === 0 ? (
        <>
          <AppText muted>{t("cart.empty")}</AppText>
          <Button title={t("cart.browseMenu")} onPress={() => router.push("/menu")} />
        </>
      ) : (
        <>
          {branch ? (
            <AppText muted>
              {t("cart.fromBranch", { branch: localized(branch, "name", locale) })}
            </AppText>
          ) : null}
          {cart.lines.map((l) => (
            <Card key={l.key}>
              <AppText style={{ fontWeight: "700" }}>
                {locale === "ar" ? l.nameAr : l.nameEn}
              </AppText>
              {l.optionNames.length ? (
                <AppText muted style={{ fontSize: 14 }}>
                  {l.optionNames.map((o) => (locale === "ar" ? o.ar : o.en)).join("، ")}
                </AppText>
              ) : null}
              {l.notes ? (
                <AppText muted style={{ fontSize: 14 }}>
                  “{l.notes}”
                </AppText>
              ) : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Stepper value={l.quantity} onChange={(n) => setQuantity(l.key, n)} />
                <AppText style={{ fontWeight: "700" }}>
                  {formatPrice(l.unitPriceFils * l.quantity, locale)}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setQuantity(l.key, 0)}>
                <AppText style={{ color: theme.danger, fontSize: 14 }}>{t("cart.remove")}</AppText>
              </Pressable>
            </Card>
          ))}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: spacing.sm,
            }}
          >
            <AppText style={{ fontWeight: "700" }}>{t("cart.subtotal")}</AppText>
            <AppText style={{ fontWeight: "700", fontSize: 18 }}>
              {formatPrice(cartSubtotal(cart), locale)}
            </AppText>
          </View>
          <AppText muted style={{ fontSize: 13 }}>
            {t("cart.pricesUpdated")}
          </AppText>
          <Button title={t("cart.checkout")} onPress={() => router.push("/checkout")} />
        </>
      )}
    </Screen>
  );
}
