import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AppRole = "admin" | "specialiste" | "agent";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Contrôle strict du statut du compte.
   * Renvoie true si le compte est actif, sinon force la déconnexion.
   */
  const enforceActiveStatus = async (uid: string): Promise<boolean> => {
    const { data } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", uid)
      .maybeSingle();
    if (data && data.status !== "active") {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setRole(null);
      toast.error("Votre compte n'est pas actif. Contactez l'administrateur.");
      return false;
    }
    return true;
  };

  const loadRole = async (uid: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      setRole(null);
      return;
    }
    const roles = data.map((r) => r.role as AppRole);
    if (roles.includes("admin")) setRole("admin");
    else if (roles.includes("specialiste")) setRole("specialiste");
    else setRole("agent");
  };

  useEffect(() => {
    // 1. Listener d'abord
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        const uid = newSession.user.id;
        // defer pour éviter deadlock
        setTimeout(async () => {
          const active = await enforceActiveStatus(uid);
          if (active) await loadRole(uid);
        }, 0);
      } else {
        setRole(null);
      }
    });

    // 2. Puis getSession
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const active = await enforceActiveStatus(s.user.id);
        if (active) await loadRole(s.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
  };

  const refreshRole = async () => {
    if (user) await loadRole(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
