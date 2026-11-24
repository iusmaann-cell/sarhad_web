import type { Session } from "@supabase/supabase-js";
import { createContext, use, useEffect, useState, type ReactNode } from "react";

import { supabase } from "./supabase";

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, loading: false }))
      .catch(() => setState({ session: null, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  return use(AuthContext);
}

/** Map Supabase auth errors to message keys. */
export function authErrorKey(error: { code?: string }) {
  if (error.code === "invalid_credentials") return "auth.invalidCredentials" as const;
  if (error.code === "email_not_confirmed") return "auth.emailNotConfirmed" as const;
  return "auth.genericError" as const;
}
