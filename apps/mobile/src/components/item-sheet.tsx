import {
  formatPrice,
  invalidModifierGroups,
  itemTotalFils,
  makeCartLine,
  type MenuItem,
} from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Stepper } from "@/components/stepper";
import { AppText, Button, TextField } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { spacing, useTheme } from "@/lib/theme";

function defaults(item: MenuItem): string[] {
  return item.modifier_groups
    .filter((g) => g.min_select === 1 && g.max_select === 1 && g.options[0])
    .map((g) => g.options[0]!.id);
}

/** Full-screen sheet to pick add-ons, quantity and a note, then add to the cart. */
export function ItemSheet({
  item,
  branchId,
  onClose,
}: {
  item: MenuItem;
  branchId: string;
  onClose: (added: boolean) => void;
}) {
  const { t, locale, isRTL } = useI18n();
  const theme = useTheme();
  const { cart, add } = useCart();
  const [selected, setSelected] = useState<string[]>(() => defaults(item));
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);
  const invalid = invalidModifierGroups(item, selected);
  const total = itemTotalFils(item, selected) * quantity;
  const otherBranch = cart.lines.length > 0 && cart.branchId !== branchId;

  function toggle(groupId: string, optionId: string) {
    const group = item.modifier_groups.find((g) => g.id === groupId)!;
    const ids = group.options.map((o) => o.id);
    setSelected((prev) => {
      if (group.max_select === 1) return [...prev.filter((id) => !ids.includes(id)), optionId];
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
      return prev.filter((id) => ids.includes(id)).length >= group.max_select
        ? prev
        : [...prev, optionId];
    });
  }

  function submit() {
    setTried(true);
    if (invalid.length) return;
    add(branchId, makeCartLine(item, selected, quantity, notes));
    onClose(true);
  }

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => onClose(false)}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.background, direction: isRTL ? "rtl" : "ltr" }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: spacing.md,
            borderBottomWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: 20, fontWeight: "700" }}>
              {localized(item, "name", locale)}
            </AppText>
            <AppText muted>{formatPrice(item.price_fils, locale)}</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("menu.close")}
            onPress={() => onClose(false)}
            hitSlop={8}
          >
            <AppText style={{ fontSize: 22 }}>✕</AppText>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
          {otherBranch ? (
            <AppText style={{ color: theme.danger }}>{t("menu.otherBranchCart")}</AppText>
          ) : null}
          {item.modifier_groups.map((g) => {
            const name = localized(g, "name", locale);
            return (
              <View key={g.id} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText style={{ fontWeight: "700" }}>{name}</AppText>
                  <AppText muted style={{ fontSize: 13 }}>
                    {g.min_select > 0 ? `${t("menu.required")} · ` : ""}
                    {g.min_select === g.max_select
                      ? t("menu.choose", { count: g.max_select })
                      : t("menu.chooseUpTo", { count: g.max_select })}
                  </AppText>
                </View>
                {g.options.map((o) => {
                  const on = selected.includes(o.id);
                  return (
                    <Pressable
                      key={o.id}
                      accessibilityRole={g.max_select === 1 ? "radio" : "checkbox"}
                      accessibilityState={{ checked: on }}
                      onPress={() => toggle(g.id, o.id)}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        padding: spacing.md,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: on ? theme.primary : theme.border,
                        backgroundColor: theme.card,
                      }}
                    >
                      <AppText style={{ fontWeight: on ? "700" : "400" }}>
                        {on ? "● " : "○ "}
                        {localized(o, "name", locale)}
                      </AppText>
                      {o.price_delta_fils > 0 ? (
                        <AppText muted>+{formatPrice(o.price_delta_fils, locale)}</AppText>
                      ) : null}
                    </Pressable>
                  );
                })}
                {tried && invalid.includes(g.id) ? (
                  <AppText style={{ color: theme.danger, fontSize: 13 }}>
                    {t("menu.chooseRequired", { group: name })}
                  </AppText>
                ) : null}
              </View>
            );
          })}
          <TextField
            label={t("menu.itemNotes")}
            placeholder={t("menu.itemNotesHint")}
            value={notes}
            onChangeText={(v) => setNotes(v.slice(0, 200))}
          />
        </ScrollView>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.md,
            borderTopWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Stepper value={quantity} onChange={setQuantity} />
          <View style={{ flex: 1 }}>
            <Button
              title={t("menu.addToCartTotal", { total: formatPrice(total, locale) })}
              onPress={submit}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
