import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, Save, Activity, Stethoscope, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin/permissions")({
  component: PermissionsPage,
});

type Row = { role: AppRole; permission: string; enabled: boolean };

const ROLES: AppRole[] = ["admin", "specialiste", "agent"];

const ROLE_META: Record<AppRole, { label: string; icon: typeof ShieldCheck; cls: string }> = {
  admin: { label: "Administrateur", icon: ShieldCheck, cls: "bg-warning/15 text-warning-foreground border-warning/30" },
  specialiste: { label: "Spécialiste", icon: Activity, cls: "bg-success-soft text-success border-success/30" },
  agent: { label: "Agent de santé", icon: Stethoscope, cls: "bg-primary-soft text-primary border-primary/30" },
};

const PERMISSION_GROUPS: { title: string; permissions: { key: string; label: string; desc?: string }[] }[] = [
  {
    title: "Administration",
    permissions: [
      { key: "users.manage", label: "Gérer les utilisateurs", desc: "Créer, modifier, supprimer les comptes" },
      { key: "facilities.manage", label: "Gérer les établissements" },
      { key: "permissions.manage", label: "Gérer les permissions" },
    ],
  },
  {
    title: "Patients",
    permissions: [
      { key: "patients.create", label: "Créer un patient" },
      { key: "patients.view", label: "Consulter les patients" },
      { key: "patients.update", label: "Mettre à jour un patient" },
    ],
  },
  {
    title: "Dossiers médicaux",
    permissions: [
      { key: "records.view", label: "Consulter les dossiers" },
      { key: "records.update", label: "Modifier les dossiers" },
    ],
  },
  {
    title: "Diagnostics & rapports",
    permissions: [
      { key: "diagnostics.create", label: "Lancer un diagnostic IA" },
      { key: "diagnostics.validate", label: "Valider un diagnostic" },
      { key: "reports.view", label: "Voir les rapports" },
    ],
  },
];

function PermissionsPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [original, setOriginal] = useState<Row[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && role && role !== "admin") navigate({ to: "/dashboard" });
  }, [loading, user, role, navigate]);

  const fetchRows = async () => {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, permission, enabled");
    if (error) {
      toast.error(error.message);
      setLoadingList(false);
      return;
    }
    const list = (data ?? []) as Row[];
    setRows(list);
    setOriginal(list);
    setLoadingList(false);
  };

  useEffect(() => {
    if (role === "admin") void fetchRows();
  }, [role]);

  const matrix = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of rows) m.set(`${r.role}::${r.permission}`, r.enabled);
    return m;
  }, [rows]);

  const dirtyKeys = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const key = `${r.role}::${r.permission}`;
      const orig = original.find((o) => o.role === r.role && o.permission === r.permission);
      if (!orig || orig.enabled !== r.enabled) set.add(key);
    }
    return set;
  }, [rows, original]);

  const toggle = (roleKey: AppRole, permission: string, value: boolean) => {
    if (roleKey === "admin") return; // Admin garde toujours tous les droits
    setRows((prev) => {
      const found = prev.find((r) => r.role === roleKey && r.permission === permission);
      if (found) {
        return prev.map((r) =>
          r.role === roleKey && r.permission === permission ? { ...r, enabled: value } : r,
        );
      }
      return [...prev, { role: roleKey, permission, enabled: value }];
    });
  };

  const reset = () => setRows(original);

  const save = async () => {
    if (dirtyKeys.size === 0) return;
    setSaving(true);
    try {
      const changes = rows.filter((r) => {
        const orig = original.find((o) => o.role === r.role && o.permission === r.permission);
        return !orig || orig.enabled !== r.enabled;
      });
      const { error } = await supabase
        .from("role_permissions")
        .upsert(
          changes.map((c) => ({
            role: c.role,
            permission: c.permission,
            enabled: c.enabled,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "role,permission" },
        );
      if (error) throw error;
      toast.success(`${changes.length} permission(s) enregistrée(s)`);
      await fetchRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user || role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero shadow-glow">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-base font-semibold tracking-tight">Permissions</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tableau de bord
        </Link>

        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                Permissions & accès
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Configurez les droits attribués à chaque rôle. Le rôle <span className="font-medium">administrateur</span> conserve toujours tous les droits.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset} disabled={dirtyKeys.size === 0 || saving}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Annuler
            </Button>
            <Button size="sm" onClick={save} disabled={dirtyKeys.size === 0 || saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Enregistrer {dirtyKeys.size > 0 && `(${dirtyKeys.size})`}
            </Button>
          </div>
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {PERMISSION_GROUPS.map((group) => (
              <section key={group.title} className="rounded-xl border border-border/60 bg-card shadow-soft overflow-hidden">
                <div className="border-b border-border/60 bg-muted/30 px-5 py-3">
                  <h2 className="font-display text-base font-semibold">{group.title}</h2>
                </div>
                <div className="hidden grid-cols-12 gap-3 border-b border-border/60 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                  <div className="col-span-6">Permission</div>
                  {ROLES.map((r) => (
                    <div key={r} className="col-span-2 text-center">
                      <Badge variant="outline" className={`gap-1 ${ROLE_META[r].cls}`}>
                        {ROLE_META[r].label}
                      </Badge>
                    </div>
                  ))}
                </div>
                <ul className="divide-y divide-border/60">
                  {group.permissions.map((p) => (
                    <li key={p.key} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-12 md:items-center">
                      <div className="md:col-span-6">
                        <p className="text-sm font-medium">{p.label}</p>
                        {p.desc && <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>}
                        <code className="mt-1 inline-block text-[10px] text-muted-foreground/70">{p.key}</code>
                      </div>
                      {ROLES.map((r) => {
                        const checked = matrix.get(`${r}::${p.key}`) ?? false;
                        const dirty = dirtyKeys.has(`${r}::${p.key}`);
                        const locked = r === "admin";
                        return (
                          <div key={r} className="flex items-center justify-between md:col-span-2 md:justify-center">
                            <span className="text-xs text-muted-foreground md:hidden">{ROLE_META[r].label}</span>
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={checked}
                                onCheckedChange={(v) => toggle(r, p.key, v)}
                                disabled={locked || saving}
                              />
                              {dirty && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="modifié" />}
                            </div>
                          </div>
                        );
                      })}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
