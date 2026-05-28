"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { createBrowserClient } from "@/lib/supabase";
import type { Profile } from "@/types";

interface AuthContextValue {
  /** The Supabase auth user, or null when signed out. */
  user: User | null;
  /** The user's DormDrop profile row, or null while loading / signed out. */
  profile: Profile | null;
  /** True until the initial session + profile fetch resolves. */
  loading: boolean;
  /** Sign the user out (clears the session + local state). */
  signOut: () => Promise<void>;
  /** Re-fetch the profile (e.g. after onboarding or editing settings). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * App-wide auth context. Holds the current user + profile, keeps them in sync
 * with Supabase's auth state, and exposes sign-out.
 *
 * The Supabase client is created inside an effect (never during render) so this
 * provider can safely wrap statically-prerendered pages — at build time there
 * are no Supabase env vars, and effects don't run during prerender.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    clientRef.current = supabase;
    let active = true;

    async function syncProfile(nextUser: User | null) {
      if (!nextUser) {
        if (active) setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", nextUser.id)
        .single();
      if (active) setProfile((data as Profile | null) ?? null);
    }

    async function applySession(session: Session | null) {
      const nextUser = session?.user ?? null;
      if (active) setUser(nextUser);
      await syncProfile(nextUser);
      if (active) setLoading(false);
    }

    // Initial load.
    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session);
    });

    // Keep in sync on sign-in / sign-out / token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = clientRef.current ?? createBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const supabase = clientRef.current;
    if (!supabase || !user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile((data as Profile | null) ?? null);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Access the auth context. Throws if used outside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return ctx;
}
