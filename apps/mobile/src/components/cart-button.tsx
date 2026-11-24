import { cartCount } from "@sarhad/core";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/** Cart shortcut for the header, with the number of items. */
export function CartButton() {
  const { cart } = useCart();
  const { t } = useI18n();
  const theme = useTheme();
  const count = cartCount(cart);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t("nav.cart")} (${count})`}
      onPress={() => router.push("/cart")}
      hitSlop={8}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={{ color: theme.primary, fontWeight: "600" }}>{t("nav.cart")}</Text>
        {count > 0 ? (
          <View
            style={{
              minWidth: 20,
              paddingHorizontal: 5,
              borderRadius: 10,
              backgroundColor: theme.primary,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.primaryText, fontSize: 12, fontWeight: "700" }}>
              {count}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
