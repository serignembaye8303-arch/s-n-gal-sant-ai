import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Activity, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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

const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional(),
  facility: z.string().trim().max(150).optional(),
});

function AuthPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [facility, setFacility] = useState("");

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "signin") {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(t("auth.error.generic"));
          return;
        }
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) {
          toast.error(t("auth.error.invalid"));
          return;
        }
        navigate({ to: "/dashboard" });
      } else {
        const parsed = signUpSchema.safeParse({ email, password, fullName, phone, facility });
        if (!parsed.success) {
          toast.error(t("auth.error.generic"));
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: parsed.data.fullName,
              phone: parsed.data.phone ?? "",
              facility: parsed.data.facility ?? "",
            },
          },
        });
        if (error) {
          toast.error(error.message || t("auth.error.generic"));
          return;
        }
        toast.success(t("auth.success.signup"));
        navigate({ to: "/dashboard" });
      }
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
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {mode === "signin" ? t("auth.signin.title") : t("auth.signup.title")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {mode === "signin" ? t("auth.signin.subtitle") : t("auth.signup.subtitle")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <Field
                    id="fullName"
                    label={t("auth.fullname")}
                    value={fullName}
                    onChange={setFullName}
                    required
                    maxLength={100}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="phone" label={t("auth.phone")} value={phone} onChange={setPhone} maxLength={30} type="tel" />
                    <Field id="facility" label={t("auth.facility")} value={facility} onChange={setFacility} maxLength={150} />
                  </div>
                </>
              )}
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
                ) : mode === "signin" ? (
                  t("auth.signin.button")
                ) : (
                  t("auth.signup.button")
                )}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-6 block w-full text-center text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {mode === "signin" ? t("auth.toggle.signup") : t("auth.toggle.signin")}
            </button>
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
