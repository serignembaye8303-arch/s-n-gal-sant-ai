import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Activity, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchPrimaryRole, roleHomePath } from "@/lib/role-routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/confirm")({
  head: () => ({
    meta: [
      { title: "Confirmation du compte — Sénégal Santé-IA" },
      { name: "description", content: "Activez votre compte et définissez votre mot de passe." },
    ],
  }),
  component: ConfirmPage,
});

type Status = "verifying" | "needs_password" | "success" | "error";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Au moins 8 caractères").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Les mots de passe ne correspondent pas",
  });

function ConfirmPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flowType, setFlowType] = useState<"invite" | "recovery" | "signup" | "magiclink">("invite");

  useEffect(() => {
    const run = async () => {
      try {
        // Cas 1 : tokens dans le hash (#access_token=...) — auto-géré par detectSessionInUrl
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const url = new URL(window.location.href);
        const token_hash = url.searchParams.get("token_hash");
        const type = (url.searchParams.get("type") ||
          new URLSearchParams(hash.replace(/^#/, "")).get("type") ||
          "invite") as Status extends never ? never : "invite" | "recovery" | "signup" | "magiclink";
        setFlowType(type as never);

        if (token_hash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as never,
          });
          if (error) throw error;
        } else if (hash.includes("access_token")) {
          // Session déjà créée par le SDK via le hash
          await supabase.auth.getSession();
        } else {
          throw new Error("Lien d'invitation invalide ou expiré.");
        }

        // Pour invite/recovery → demander un mot de passe
        if (type === "invite" || type === "recovery") {
          setStatus("needs_password");
        } else {
          // signup confirmation → activer + rediriger
          await activateAndRedirect();
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Erreur de confirmation.");
        setStatus("error");
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activateAndRedirect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Active le profil (au cas où il aurait été suspendu en attente)
      await supabase.from("profiles").update({ status: "active" }).eq("id", user.id);
      const role = await fetchPrimaryRole(user.id);
      setStatus("success");
      setTimeout(() => navigate({ to: roleHomePath(role) }), 1200);
    } else {
      setStatus("success");
      setTimeout(() => navigate({ to: "/auth" }), 1200);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Mot de passe invalide");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Compte activé");
      await activateAndRedirect();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'activation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="flex items-center gap-2 mb-8 text-foreground">
        <Activity className="h-6 w-6 text-primary" />
        <span className="font-semibold">Sénégal Santé-IA</span>
      </Link>

      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        {status === "verifying" && (
          <div className="text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Vérification du lien…</h1>
            <p className="text-sm text-muted-foreground">Merci de patienter.</p>
          </div>
        )}

        {status === "needs_password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">
                {flowType === "recovery" ? "Réinitialiser le mot de passe" : "Activer votre compte"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Choisissez un mot de passe sécurisé (8 caractères minimum).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activer mon compte"}
            </Button>
          </form>
        )}

        {status === "success" && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Compte activé</h1>
            <p className="text-sm text-muted-foreground">Redirection en cours…</p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center space-y-4">
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Lien invalide</h1>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">Retour à la connexion</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
