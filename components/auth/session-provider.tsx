"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type SessionState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isProvider: boolean; // provider or admin
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(
    async (uid: string | null) => {
      if (!uid) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle<Profile>();
      setProfile(data ?? null);
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return;
      setUser(data.user ?? null);
      await fetchProfile(data.user?.id ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      await fetchProfile(u?.id ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile(user?.id ?? null);
  }, [fetchProfile, user?.id]);

  const signOut = useCallback(async () => {
    // Fire the server revoke with a short timeout so the UI never stalls, then
    // clear local state immediately (local scope = no network).
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (url && anonKey && token) {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 3000);
        fetch(`${url}/auth/v1/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
          signal: ctrl.signal,
        }).catch(() => {});
      }
    } catch {
      /* noop */
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* noop */
    }
    setUser(null);
    setProfile(null);
  }, [supabase]);

  const value = useMemo<SessionState>(
    () => ({
      user,
      profile,
      loading,
      isProvider: profile?.role === "provider" || profile?.role === "admin",
      isAdmin: profile?.role === "admin",
      refreshProfile,
      signOut,
    }),
    [user, profile, loading, refreshProfile, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
