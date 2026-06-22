import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Activity, AlertTriangle, ArrowLeft, Loader2, ShieldCheck, Stethoscope, Plus, Pencil, Trash2, MoreVertical } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { listUsers, setUserRole, createUser, updateUser, deleteUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/dashboard/admin/users")({
  component: AdminUsersPage,
  errorComponent: AdminUsersRouteError,
});

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];
type Status = "active" | "suspended" | "disabled";

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Erreur inconnue";
  }
}

function AdminUsersRouteError({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[dashboard/admin/users] Route render error", error);
  return (
    <AdminUsersErrorView
      title="Erreur de chargement des utilisateurs"
      message={describeError(error)}
      details={error.stack ?? describeError(error)}
      onRetry={reset}
    />
  );
}

function AdminUsersErrorView({
  title,
  message,
  details,
  onRetry,
}: {
  title: string;
  message: string;
  details?: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <div className="w-full rounded-xl border border-destructive/30 bg-card p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{message}</p>
              {details && (
                <pre className="mt-4 max-h-72 overflow-auto rounded-lg border border-border/60 bg-muted/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                  {details}
                </pre>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button type="button" onClick={onRetry}>Réessayer</Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/dashboard">Retour au dashboard</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function AdminUsersPage() {
  const { user, role, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const listUsersFn = useServerFn(listUsers);
  const setUserRoleFn = useServerFn(setUserRole);
  const deleteUserFn = useServerFn(deleteUser);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && role && role !== "admin") navigate({ to: "/dashboard" });
  }, [loading, user, role, navigate]);

  const refresh = async () => {
    setLoadingList(true);
    setListError(null);
    try {
      console.info("[dashboard/admin/users] listUsers:start", { role, userId: user?.id });
      const data = await listUsersFn();
      console.info("[dashboard/admin/users] listUsers:success", {
        count: data.length,
        columns: ["id", "nom", "email", "role", "statut", "created_at"],
      });
      setUsers(data);
    } catch (e) {
      const message = describeError(e);
      console.error("[dashboard/admin/users] listUsers:error", e);
      setListError(message);
      setUsers([]);
      toast.error(message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (role === "admin") refresh();
  }, [role]);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdatingId(userId);
    try {
      await setUserRoleFn({ data: { user_id: userId, role: newRole } });
      toast.success("Rôle mis à jour");
      await refresh();
    } catch (e) {
      console.error("[dashboard/admin/users] setUserRole:error", e);
      toast.error(describeError(e));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUserFn({ data: { user_id: deleteTarget.id } });
      toast.success("Utilisateur supprimé");
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      console.error("[dashboard/admin/users] deleteUser:error", e);
      toast.error(describeError(e));
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
              <Activity className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-base font-semibold tracking-tight">
              {t("app.name")}
            </span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("dashboard.role.admin")}
        </Link>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {t("admin.users.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t("admin.users.intro")}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Ajouter un utilisateur
          </Button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/dashboard/admin/agents"
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-soft transition-all hover:border-primary/40 hover:shadow-elevated"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Agents de santé</p>
              <p className="text-xs text-muted-foreground">Gérer et créer des comptes agents</p>
            </div>
          </Link>
          <Link
            to="/dashboard/admin/specialiste"
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-soft transition-all hover:border-primary/40 hover:shadow-elevated"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-soft text-success">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Spécialistes</p>
              <p className="text-xs text-muted-foreground">Gérer et créer des comptes spécialistes</p>
            </div>
          </Link>
        </div>

        <div className="rounded-xl border border-border/60 bg-card shadow-soft">
          <div className="grid grid-cols-12 gap-3 border-b border-border/60 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div className="col-span-3">{t("admin.users.user")}</div>
            <div className="col-span-2 hidden md:block">{t("auth.facility")}</div>
            <div className="col-span-2 hidden md:block">Statut</div>
            <div className="col-span-2 hidden md:block">{t("admin.users.current")}</div>
            <div className="col-span-12 md:col-span-3 text-right">Actions</div>
          </div>

          {listError ? (
            <div className="p-5">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-destructive">Impossible de charger les utilisateurs</p>
                    <p className="mt-1 text-sm text-muted-foreground">{listError}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Colonnes attendues : id, nom, email, role, statut, created_at.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={refresh} className="mt-3">
                      Réessayer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : loadingList ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {t("admin.users.empty")}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {users.map((u) => {
                const isSelf = u.id === user.id;
                return (
                  <li key={u.id} className="grid grid-cols-12 items-center gap-3 px-5 py-4">
                    <div className="col-span-12 md:col-span-3">
                      <p className="font-medium">
                        {u.full_name || <span className="text-muted-foreground">—</span>}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({t("admin.users.you")})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email || u.id.slice(0, 8)}</p>
                    </div>
                    <div className="col-span-6 hidden text-sm text-muted-foreground md:col-span-2 md:block">
                      {u.facility || "—"}
                    </div>
                    <div className="col-span-6 hidden md:col-span-2 md:block">
                      <StatusBadge status={u.status} />
                    </div>
                    <div className="col-span-6 hidden md:col-span-2 md:block">
                      <RoleBadgeInline role={u.primary_role} />
                    </div>
                    <div className="col-span-12 flex items-center justify-end gap-2 md:col-span-3">
                      <Select
                        value={u.primary_role}
                        onValueChange={(v) => handleRoleChange(u.id, v as AppRole)}
                        disabled={updatingId === u.id || (isSelf && u.primary_role === "admin")}
                      >
                        <SelectTrigger className="h-9 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">{t("dashboard.role.agent")}</SelectItem>
                          <SelectItem value="specialiste">{t("dashboard.role.specialist")}</SelectItem>
                          <SelectItem value="admin">{t("dashboard.role.admin")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditTarget(u)}>
                            <Pencil className="mr-2 h-4 w-4" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(u)}
                            disabled={isSelf}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
      <EditUserDialog target={editTarget} onOpenChange={(o) => !o && setEditTarget(null)} onSaved={refresh} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprime définitivement le compte de{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.full_name || deleteTarget?.email}
              </span>
              . Une trace est conservée dans les journaux d'audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const createUserFn = useServerFn(createUser);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [facility, setFacility] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("agent");

  const reset = () => {
    setFullName(""); setEmail(""); setPhone(""); setFacility(""); setPassword(""); setRole("agent");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createUserFn({
        data: { full_name: fullName, email, phone, facility, password, role },
      });
      toast.success("Utilisateur créé");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un utilisateur</DialogTitle>
          <DialogDescription>
            Créez un compte avec un rôle attribué. L'email est confirmé automatiquement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField id="c-fullname" label="Nom complet" value={fullName} onChange={setFullName} required maxLength={100} />
          <div className="grid grid-cols-2 gap-3">
            <FormField id="c-email" label="Email" type="email" value={email} onChange={setEmail} required maxLength={255} />
            <FormField id="c-phone" label="Téléphone" type="tel" value={phone} onChange={setPhone} maxLength={30} />
          </div>
          <FormField id="c-facility" label="Centre de santé" value={facility} onChange={setFacility} maxLength={150} />
          <FormField id="c-password" label="Mot de passe" type="password" value={password} onChange={setPassword} required minLength={8} maxLength={72} />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="specialiste">Spécialiste</SelectItem>
                <SelectItem value="agent">Agent de santé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: UserRow | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const updateUserFn = useServerFn(updateUser);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [facility, setFacility] = useState("");
  const [role, setRole] = useState<AppRole>("agent");
  const [status, setStatus] = useState<Status>("active");

  useEffect(() => {
    if (target) {
      setFullName(target.full_name);
      setPhone(target.phone);
      setFacility(target.facility);
      setRole(target.primary_role);
      setStatus(target.status);
    }
  }, [target]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSubmitting(true);
    try {
      await updateUserFn({
        data: {
          user_id: target.id,
          full_name: fullName,
          phone,
          facility,
          role,
          status,
        },
      });
      toast.success("Utilisateur mis à jour");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier l'utilisateur</DialogTitle>
          <DialogDescription>{target?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField id="e-fullname" label="Nom complet" value={fullName} onChange={setFullName} required maxLength={100} />
          <div className="grid grid-cols-2 gap-3">
            <FormField id="e-phone" label="Téléphone" type="tel" value={phone} onChange={setPhone} maxLength={30} />
            <FormField id="e-facility" label="Centre de santé" value={facility} onChange={setFacility} maxLength={150} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rôle (permissions)</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="specialiste">Spécialiste</SelectItem>
                  <SelectItem value="agent">Agent de santé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                  <SelectItem value="disabled">Désactivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  id, label, value, onChange, type = "text", required, maxLength, minLength,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; maxLength?: number; minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} maxLength={maxLength} minLength={minLength} className="h-10" />
    </div>
  );
}

function RoleBadgeInline({ role }: { role: AppRole }) {
  const { t } = useI18n();
  const map = {
    admin: { label: t("dashboard.role.admin"), cls: "bg-warning/15 text-warning-foreground border-warning/30", Icon: ShieldCheck },
    specialiste: { label: t("dashboard.role.specialist"), cls: "bg-success-soft text-success border-success/30", Icon: Activity },
    agent: { label: t("dashboard.role.agent"), cls: "bg-primary-soft text-primary border-primary/30", Icon: Stethoscope },
  } as const;
  const { label, cls, Icon } = map[role];
  return (
    <Badge variant="outline" className={`gap-1.5 ${cls}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs font-medium">{label}</span>
    </Badge>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    active: { label: "Actif", cls: "bg-success-soft text-success border-success/30" },
    suspended: { label: "Suspendu", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    disabled: { label: "Désactivé", cls: "bg-muted text-muted-foreground border-border" },
  };
  const { label, cls } = map[status];
  return <Badge variant="outline" className={`text-xs ${cls}`}>{label}</Badge>;
}
