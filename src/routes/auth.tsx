import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Activity, Loader2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { roleHomePath, fetchPrimaryRole } from "@/lib/role-routing";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

function AuthPage() {
  const { t } = useI18n();
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: roleHomePath(role) });
    }
  }, [user, loading, role, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const parsed = signInSchema.safeParse({ email, password });
      if (!parsed.success) {
        toast.error(t("auth.error.generic"));
        return;
      }

      const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error || !signInData.user) {
        toast.error(t("auth.error.invalid"));
        return;
      }

      // Vérifier le statut actif du profil
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", signInData.user.id)
        .maybeSingle();

      if (profile && profile.status !== "active") {
        await supabase.auth.signOut();
        toast.error("Votre compte est suspendu. Contactez l'administrateur.");
        return;
      }

      const targetRole = await fetchPrimaryRole(signInData.user.id);
      navigate({ to: roleHomePath(targetRole) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero shadow-glow">
            <Activity className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-sm font-semibold">{t("app.name")}</span>
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="absolute inset-0 grid-pattern opacity-30" aria-hidden />
      <div className="absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-soft" aria-hidden />

      <main className="relative flex flex-1 items-center justify-center px-4 py-20">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-elevated">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Connexion sécurisée
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Espace réservé aux professionnels de santé autorisés.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field
                id="email"
                label={t("auth.email")}
                value={email}
                onChange={setEmail}
                required
                type="email"
                maxLength={255}
              />
              <Field
                id="password"
                label={t("auth.password")}
                value={password}
                onChange={setPassword}
                required
                type="password"
                minLength={6}
                maxLength={72}
              />

              <Button type="submit" disabled={submitting} className="h-11 w-full">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("auth.signin.button")
                )}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Pas d'auto-inscription.</span>{" "}
                Les comptes sont créés exclusivement par l'administrateur. Si vous avez besoin d'un accès, contactez votre établissement.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  maxLength,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        minLength={minLength}
        className="h-10"
      />
    </div>
  );
}
