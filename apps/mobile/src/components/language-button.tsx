import { otherLocale } from "@sarhad/i18n";
import { Pressable, Text } from "react-native";

import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export function LanguageButton() {
  const { locale, setLocale, t } = useI18n();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.language")}
      onPress={() => setLocale(otherLocale(locale))}
      hitSlop={8}
    >
      <Text style={{ color: theme.primary, fontWeight: "600" }}>{t("common.switchLanguage")}</Text>
    </Pressable>
  );
}
