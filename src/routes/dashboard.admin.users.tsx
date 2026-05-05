import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, Loader2, ShieldCheck, Stethoscope, UserCog } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { listUsers, setUserRole } from "@/server/admin.functions";

export const Route = createFileRoute("/dashboard/admin/users")({
  component: AdminUsersPage,
});

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

function AdminUsersPage() {
  const { user, role, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && role && role !== "admin") navigate({ to: "/dashboard" });
  }, [loading, user, role, navigate]);

  const refresh = async () => {
    setLoadingList(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
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
      await setUserRole({ data: { user_id: userId, role: newRole } });
      toast.success("Rôle mis à jour");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setUpdatingId(null);
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
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {t("admin.users.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("admin.users.intro")}
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card shadow-soft">
          <div className="grid grid-cols-12 gap-3 border-b border-border/60 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div className="col-span-4">{t("admin.users.user")}</div>
            <div className="col-span-3 hidden md:block">{t("auth.facility")}</div>
            <div className="col-span-2 hidden md:block">{t("admin.users.current")}</div>
            <div className="col-span-12 md:col-span-3">{t("admin.users.change")}</div>
          </div>

          {loadingList ? (
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
                  <li
                    key={u.id}
                    className="grid grid-cols-12 items-center gap-3 px-5 py-4"
                  >
                    <div className="col-span-12 md:col-span-4">
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
                    <div className="col-span-6 hidden text-sm text-muted-foreground md:col-span-3 md:block">
                      {u.facility || "—"}
                    </div>
                    <div className="col-span-6 hidden md:col-span-2 md:block">
                      <RoleBadgeInline role={u.primary_role} />
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      <Select
                        value={u.primary_role}
                        onValueChange={(v) => handleRoleChange(u.id, v as AppRole)}
                        disabled={updatingId === u.id || (isSelf && u.primary_role === "admin")}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">{t("dashboard.role.agent")}</SelectItem>
                          <SelectItem value="specialist">{t("dashboard.role.specialist")}</SelectItem>
                          <SelectItem value="admin">{t("dashboard.role.admin")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function RoleBadgeInline({ role }: { role: AppRole }) {
  const { t } = useI18n();
  const map = {
    admin: { label: t("dashboard.role.admin"), cls: "bg-warning/15 text-warning-foreground border-warning/30", Icon: ShieldCheck },
    specialist: { label: t("dashboard.role.specialist"), cls: "bg-success-soft text-success border-success/30", Icon: Activity },
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
