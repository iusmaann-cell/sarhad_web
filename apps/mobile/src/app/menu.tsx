import { cartCount, cartSubtotal, formatPrice, menuImageUrl, type MenuItem } from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { ItemSheet } from "@/components/item-sheet";
import { AppText, Button, Card, Screen, Title } from "@/components/ui";
import { useBranches, useBranchMenu } from "@/lib/branches";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { spacing, useTheme } from "@/lib/theme";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

function ItemRow({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const img = menuImageUrl(SUPABASE_URL, item.image_path);
  const description = localized(item, "description", locale);
  return (
    <Card>
      <View
        style={{ flexDirection: "row", gap: spacing.md, opacity: item.is_available ? 1 : 0.55 }}
      >
        {img ? (
          <Image
            source={img}
            style={{ width: 76, height: 76, borderRadius: 10 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{ width: 76, height: 76, borderRadius: 10, backgroundColor: theme.border }}
          />
        )}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText style={{ fontWeight: "700" }}>{localized(item, "name", locale)}</AppText>
          {description ? (
            <AppText muted numberOfLines={2} style={{ fontSize: 14 }}>
              {description}
            </AppText>
          ) : null}
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <AppText style={{ color: theme.primary, fontWeight: "700" }}>
              {formatPrice(item.price_fils, locale)}
            </AppText>
            {!item.is_available ? (
              <AppText style={{ color: theme.danger, fontSize: 13, fontWeight: "600" }}>
                {t("menu.soldOut")}
              </AppText>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("menu.add")}: ${localized(item, "name", locale)}`}
                onPress={onAdd}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 999,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                }}
              >
                <AppText style={{ color: theme.primaryText, fontWeight: "700", fontSize: 14 }}>
                  + {t("menu.add")}
                </AppText>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function MenuScreen() {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const { branches, loading: loadingBranches } = useBranches();
  const [branchId, setBranchId] = useState<string>();
  const current = branches.find((b) => b.id === branchId) ?? branches[0];
  const { menu, loading } = useBranchMenu(current?.id);
  const { cart } = useCart();
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const count = cartCount(cart);

  return (
    <Screen>
      <Title>{t("menu.title")}</Title>
      <AppText muted>{t("menu.subtitle")}</AppText>

      {branches.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {branches.map((b) => {
            const active = b.id === current?.id;
            return (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setBranchId(b.id)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.primary : theme.card,
                }}
              >
                <AppText style={{ color: active ? theme.primaryText : theme.text, fontSize: 14 }}>
                  {localized(b, "name", locale)}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {loadingBranches || loading ? <ActivityIndicator color={theme.primary} /> : null}
      {!loadingBranches && !loading && menu.length === 0 ? (
        <AppText muted>{t("menu.emptyMenu")}</AppText>
      ) : null}

      {menu.map((c) => (
        <View key={c.id} style={{ gap: spacing.sm }}>
          <AppText style={{ fontSize: 20, fontWeight: "700", marginTop: spacing.sm }}>
            {localized(c, "name", locale)}
          </AppText>
          {c.items.map((item) => (
            <ItemRow key={item.id} item={item} onAdd={() => setSheetItem(item)} />
          ))}
        </View>
      ))}

      {count > 0 ? (
        <View>
          <Button
            title={`${t("menu.viewCart")} · ${count} · ${formatPrice(cartSubtotal(cart), locale)}`}
            onPress={() => router.push("/cart")}
          />
        </View>
      ) : null}

      {sheetItem && current ? (
        <ItemSheet item={sheetItem} branchId={current.id} onClose={() => setSheetItem(null)} />
      ) : null}
    </Screen>
  );
}
