import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "@/lib/i18n";
import { spacing, useTheme } from "@/lib/theme";

/** Text that follows the current language direction. */
export function AppText({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  const theme = useTheme();
  const { isRTL } = useI18n();
  return (
    <Text
      style={[
        {
          color: muted ? theme.muted : theme.text,
          fontSize: 16,
          textAlign: isRTL ? "right" : "left",
          writingDirection: isRTL ? "rtl" : "ltr",
        },
        style,
      ]}
      {...props}
    />
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <AppText style={styles.title}>{children}</AppText>;
}

/** Scrollable page with safe area and keyboard handling. */
export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={["bottom", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "link" | "danger";
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const isPrimary = variant === "primary";
  const filled = isPrimary || variant === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        variant === "link" ? styles.link : styles.button,
        isPrimary && { backgroundColor: theme.primary },
        variant === "danger" && { backgroundColor: theme.danger },
        variant === "outline" && {
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
        },
        (pressed || disabled) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? theme.primaryText : theme.primary} />
      ) : (
        <Text
          style={{
            color: filled ? theme.primaryText : theme.primary,
            fontWeight: "600",
            fontSize: 16,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  hint,
  ltr,
  style,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string; ltr?: boolean }) {
  const theme = useTheme();
  const { isRTL } = useI18n();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText style={{ fontWeight: "600", fontSize: 14 }}>{label}</AppText>
      <TextInput
        placeholderTextColor={theme.muted}
        style={[
          styles.input,
          {
            borderColor: error ? theme.danger : theme.border,
            backgroundColor: theme.card,
            color: theme.text,
            // Emails and passwords are always typed left to right.
            textAlign: ltr ? "left" : isRTL ? "right" : "left",
          },
          style,
        ]}
        aria-invalid={!!error}
        {...props}
      />
      {error ? (
        <AppText style={{ color: theme.danger, fontSize: 13 }}>{error}</AppText>
      ) : hint ? (
        <AppText muted style={{ fontSize: 12 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Notice({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const theme = useTheme();
  const color = kind === "error" ? theme.danger : theme.success;
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: color }]}>
      <AppText style={{ color }}>{children}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  title: { fontSize: 26, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 14, padding: spacing.md, gap: spacing.sm },
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { paddingVertical: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  notice: { borderWidth: 1, borderRadius: 10, padding: spacing.md },
});
