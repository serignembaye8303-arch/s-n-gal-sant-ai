import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowLeft, Loader2, Plus, Pencil, Trash2, MoreVertical, ShieldCheck, Stethoscope } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MailOff, Copy, Check } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { listUsers, createUser, updateUser, deleteUser } from "@/server/admin.functions";

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];
type Status = "active" | "suspended" | "disabled";

interface Props {
  scopedRole: Extract<AppRole, "agent" | "specialist">;
  title: string;
  intro: string;
}

export function RoleUsersManager({ scopedRole, title, intro }: Props) {
  const { user, role, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [tab, setTab] = useState<"list" | "create">("list");
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && role && role !== "admin") navigate({ to: "/dashboard" });
  }, [loading, user, role, navigate]);

  const refresh = async () => {
    setLoadingList(true);
    try {
      const data = await listUsers();
      setUsers(data.filter((u) => u.primary_role === scopedRole));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (role === "admin") refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, scopedRole]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser({ data: { user_id: deleteTarget.id } });
      toast.success("Utilisateur supprimé");
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  if (loading || !user || role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const Icon = scopedRole === "specialist" ? Activity : Stethoscope;

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
        <Link
          to="/dashboard/admin/users"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tous les utilisateurs
        </Link>
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "list" | "create")}>
          <TabsList>
            <TabsTrigger value="list">Liste ({users?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="create" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Créer un compte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <div className="rounded-xl border border-border/60 bg-card shadow-soft">
              <div className="grid grid-cols-12 gap-3 border-b border-border/60 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <div className="col-span-4">Utilisateur</div>
                <div className="col-span-3 hidden md:block">Centre de santé</div>
                <div className="col-span-2 hidden md:block">Statut</div>
                <div className="col-span-12 md:col-span-3 text-right">Actions</div>
              </div>

              {loadingList ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !users || users.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Aucun compte pour le moment.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {users.map((u) => (
                    <li key={u.id} className="grid grid-cols-12 items-center gap-3 px-5 py-4">
                      <div className="col-span-12 md:col-span-4">
                        <p className="font-medium">
                          {u.full_name || <span className="text-muted-foreground">—</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email || u.id.slice(0, 8)}</p>
                      </div>
                      <div className="col-span-6 hidden text-sm text-muted-foreground md:col-span-3 md:block">
                        {u.facility || "—"}
                      </div>
                      <div className="col-span-6 hidden md:col-span-2 md:block">
                        <StatusBadge status={u.status} />
                      </div>
                      <div className="col-span-12 flex items-center justify-end gap-2 md:col-span-3">
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
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="create" className="mt-6">
            <CreateForm
              scopedRole={scopedRole}
              onCreated={async () => {
                await refresh();
                setTab("list");
              }}
            />
          </TabsContent>
        </Tabs>
      </main>

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

function CreateForm({
  scopedRole,
  onCreated,
}: {
  scopedRole: Extract<AppRole, "agent" | "specialist">;
  onCreated: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [facility, setFacility] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createUser({
        data: { full_name: fullName, email, phone, facility, password, role: scopedRole },
      });
      toast.success("Compte créé avec succès");
      setFullName(""); setEmail(""); setPhone(""); setFacility(""); setPassword("");
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = scopedRole === "specialist" ? "spécialiste" : "agent de santé";

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-soft">
      <h2 className="mb-1 font-display text-lg font-semibold">Nouveau compte {roleLabel}</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Le rôle <span className="font-medium text-foreground">{roleLabel}</span> est attribué automatiquement.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="r-fullname" label="Nom complet" value={fullName} onChange={setFullName} required maxLength={100} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField id="r-email" label="Email" type="email" value={email} onChange={setEmail} required maxLength={255} />
          <FormField id="r-phone" label="Téléphone" type="tel" value={phone} onChange={setPhone} maxLength={30} />
        </div>
        <FormField id="r-facility" label="Centre de santé" value={facility} onChange={setFacility} maxLength={150} />
        <FormField id="r-password" label="Mot de passe initial" type="password" value={password} onChange={setPassword} required minLength={8} maxLength={72} />
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Créer le compte
          </Button>
        </div>
      </form>
    </div>
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
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [facility, setFacility] = useState("");
  const [status, setStatus] = useState<Status>("active");

  useEffect(() => {
    if (target) {
      setFullName(target.full_name);
      setPhone(target.phone);
      setFacility(target.facility);
      setStatus(target.status);
    }
  }, [target]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSubmitting(true);
    try {
      await updateUser({
        data: { user_id: target.id, full_name: fullName, phone, facility, status },
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
          <FormField id="ed-fullname" label="Nom complet" value={fullName} onChange={setFullName} required maxLength={100} />
          <div className="grid grid-cols-2 gap-3">
            <FormField id="ed-phone" label="Téléphone" type="tel" value={phone} onChange={setPhone} maxLength={30} />
            <FormField id="ed-facility" label="Centre de santé" value={facility} onChange={setFacility} maxLength={150} />
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

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    active: { label: "Actif", cls: "bg-success-soft text-success border-success/30" },
    suspended: { label: "Suspendu", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    disabled: { label: "Désactivé", cls: "bg-muted text-muted-foreground border-border" },
  };
  const { label, cls } = map[status];
  return <Badge variant="outline" className={`text-xs ${cls}`}>{label}</Badge>;
}

// Re-export icon for parent if needed
export { ShieldCheck };
