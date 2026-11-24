import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Database } from "@sarhad/core";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = !!url && !!key;

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase is not configured. Copy apps/mobile/.env.example to apps/mobile/.env and fill it in.",
  );
}

export const supabase = createClient<Database>(url ?? "http://localhost:54321", key ?? "missing", {
  auth: {
    // Keep the session on the device. Web uses localStorage.
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Website that hosts the password reset page linked from emails. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
