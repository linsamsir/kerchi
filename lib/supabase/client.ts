"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Singleton browser Supabase client.
 *
 * The no-op `lock` defuses a navigator.locks deadlock that can hang auth calls
 * (observed in the previous project). For a single-tab app the lock buys us
 * little and costs reliability. The 1-year cookie max-age keeps sessions alive
 * across browser restarts.
 */
export function createClient(): SupabaseClient {
  if (cached) return cached;

  // Fall back to harmless placeholders when env is absent so the app still
  // renders (with "no session") instead of crashing — e.g. before the Supabase
  // project is configured, or during `next build` prerender. Real auth/data
  // calls simply fail and are handled gracefully by callers.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (typeof window !== "undefined") {
      console.warn(
        "[kerchi] Supabase env missing — running unauthenticated. Set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
      );
    }
  }

  cached = createBrowserClient(url || "https://placeholder.supabase.co", key || "placeholder-anon-key", {
    auth: {
      lock: async (_name, _acquireTimeout, fn) => fn(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      path: "/",
      secure:
        typeof window !== "undefined"
          ? window.location.protocol === "https:"
          : true,
    },
  });
  return cached;
}
