import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme, View } from "react-native";

import { CartButton } from "@/components/cart-button";
import { LanguageButton } from "@/components/language-button";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { t, isRTL } = useI18n();
  const { loading } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  return (
    <View style={{ flex: 1, direction: isRTL ? "rtl" : "ltr" }}>
      <Stack
        screenOptions={{
          headerTintColor: theme.primary,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <CartButton />
              <LanguageButton />
            </View>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ title: t("common.brand") }} />
        <Stack.Screen name="(auth)/sign-in" options={{ title: t("nav.signIn") }} />
        <Stack.Screen name="(auth)/sign-up" options={{ title: t("nav.signUp") }} />
        <Stack.Screen name="(auth)/forgot-password" options={{ title: t("auth.forgotTitle") }} />
        <Stack.Screen name="account" options={{ title: t("account.title") }} />
        <Stack.Screen name="menu" options={{ title: t("menu.title") }} />
        <Stack.Screen name="branches" options={{ title: t("branchesPage.title") }} />
        <Stack.Screen name="delivery" options={{ title: t("nav.delivery") }} />
        <Stack.Screen name="cart" options={{ title: t("cart.title") }} />
        <Stack.Screen name="checkout" options={{ title: t("checkout.title") }} />
        <Stack.Screen name="orders/index" options={{ title: t("orders.title") }} />
        <Stack.Screen name="orders/[id]" options={{ title: t("orders.title") }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <I18nProvider>
        <AuthProvider>
          <CartProvider>
            <Navigator />
          </CartProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
