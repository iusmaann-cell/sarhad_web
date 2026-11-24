import { MAX_LINE_QUANTITY } from "@sarhad/core";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { spacing, useTheme } from "@/lib/theme";

export function Stepper({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const btn = (label: string, a11y: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <AppText style={{ fontSize: 20, fontWeight: "700", color: theme.primary }}>{label}</AppText>
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 999,
        gap: spacing.xs,
      }}
    >
      {btn("−", t("menu.decrease"), value - 1, value <= min)}
      <AppText style={{ minWidth: 24, textAlign: "center", fontWeight: "700" }}>{value}</AppText>
      {btn("+", t("menu.increase"), value + 1, value >= MAX_LINE_QUANTITY)}
    </View>
  );
}
