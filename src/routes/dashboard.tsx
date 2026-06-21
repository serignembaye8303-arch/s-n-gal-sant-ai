import { createFileRoute, useNavigate, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { Activity, LogOut, UserPlus, Users, Stethoscope, ShieldCheck, Brain, FileText, MessageSquare, Building2, BarChart3, Loader2, Clock, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, role, loading, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboardHome = location.pathname === "/dashboard";

  useEffect(() => {
    if (!isDashboardHome) return;
    if (!loading && !user) {
      navigate({ to: "/auth" });
    } else if (!loading && user && role === "admin") {
      navigate({ to: "/dashboard/admin/users" });
    } else if (!loading && user && role === "specialiste") {
      navigate({ to: "/dashboard/ai-performance" });
    }
  }, [user, role, loading, navigate, isDashboardHome]);

  if (!isDashboardHome) {
    return <Outlet />;
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const displayName = (user.user_metadata?.full_name as string) || user.email || "";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero shadow-glow">
              <Activity className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-base font-semibold tracking-tight">
              {t("app.name")}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dashboard.signout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.welcome")}, <span className="text-foreground">{displayName}</span>
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {role === "admin" && t("dashboard.admin.title")}
              {role === "specialiste" && t("dashboard.specialist.title")}
              {(!role || role === "agent") && t("dashboard.agent.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {role === "admin" && t("dashboard.admin.intro")}
              {role === "specialiste" && t("dashboard.specialist.intro")}
              {(!role || role === "agent") && t("dashboard.agent.intro")}
            </p>
          </div>
          <RoleBadge role={role} />
        </div>

        {role === "admin" && <AdminDashboard />}
        {role === "specialiste" && <SpecialistDashboard />}
        {(!role || role === "agent") && <AgentDashboard />}
      </main>
    </div>
  );
}

function RoleBadge({ role }: { role: AppRole | null }) {
  const { t } = useI18n();
  const map: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
    admin: { label: t("dashboard.role.admin"), cls: "bg-warning/15 text-warning-foreground border-warning/30", icon: ShieldCheck },
    specialiste: { label: t("dashboard.role.specialist"), cls: "bg-success-soft text-success border-success/30", icon: Activity },
    agent: { label: t("dashboard.role.agent"), cls: "bg-primary-soft text-primary border-primary/30", icon: Stethoscope },
  };
  const r = role ?? "agent";
  const { label, cls, icon: Icon } = map[r];
  return (
    <Badge variant="outline" className={`gap-1.5 px-3 py-1 ${cls}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs font-medium">{label}</span>
    </Badge>
  );
}

function StatCard({ label, value, icon: Icon, tone = "primary" }: { label: string; value: string; icon: LucideIcon; tone?: "primary" | "success" | "warning" }) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning/20 text-warning-foreground",
  }[tone];
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function ActionCard({ title, icon: Icon, soon = true, to }: { title: string; icon: LucideIcon; soon?: boolean; to?: string }) {
  const { t } = useI18n();
  const inner = (
    <>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary transition-transform group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        {soon && !to && <p className="mt-0.5 text-xs text-muted-foreground">{t("common.soon")}</p>}
      </div>
    </>
  );
  const cls = "group flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card p-5 text-left shadow-soft transition-all hover:border-primary/40 hover:shadow-elevated";
  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls}>
      {inner}
    </button>
  );
}

function AgentDashboard() {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("dashboard.stats.patients")} value="0" icon={UserPlus} tone="primary" />
        <StatCard label={t("dashboard.stats.diagnostics")} value="0" icon={Brain} tone="success" />
        <StatCard label={t("dashboard.stats.pending")} value="0" icon={Clock} tone="warning" />
        <StatCard label={t("dashboard.stats.resolved")} value="0" icon={CheckCircle2} tone="success" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard title={t("dashboard.agent.newpatient")} icon={UserPlus} />
        <ActionCard title={t("dashboard.agent.mypatients")} icon={Users} />
        <ActionCard title={t("dashboard.agent.aitriage")} icon={Brain} />
      </div>
    </div>
  );
}

function SpecialistDashboard() {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("dashboard.specialist.pending")} value="0" icon={Clock} tone="warning" />
        <StatCard label={t("dashboard.specialist.consultations")} value="0" icon={FileText} tone="primary" />
        <StatCard label={t("dashboard.stats.diagnostics")} value="0" icon={Brain} tone="success" />
        <StatCard label={t("dashboard.stats.resolved")} value="0" icon={CheckCircle2} tone="success" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard title={t("dashboard.specialist.pending")} icon={FileText} />
        <ActionCard title={t("dashboard.specialist.consultations")} icon={Stethoscope} />
        <ActionCard title={t("dashboard.specialist.messages")} icon={MessageSquare} />
        <ActionCard title={t("aiperf.nav")} icon={BarChart3} to="/dashboard/ai-performance" />
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("dashboard.admin.users")} value="0" icon={Users} tone="primary" />
        <StatCard label={t("dashboard.admin.facilities")} value="0" icon={Building2} tone="success" />
        <StatCard label={t("dashboard.stats.diagnostics")} value="0" icon={Brain} tone="warning" />
        <StatCard label={t("dashboard.admin.activity")} value="—" icon={BarChart3} tone="primary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard title={t("dashboard.admin.users")} icon={Users} to="/dashboard/admin/users" />
        <ActionCard title="Agents de santé" icon={Stethoscope} to="/dashboard/admin/agents" />
        <ActionCard title="Spécialistes" icon={Activity} to="/dashboard/admin/specialists" />
        <ActionCard title={t("aiperf.nav")} icon={BarChart3} to="/dashboard/ai-performance" />
        <ActionCard title={t("dashboard.admin.facilities")} icon={Building2} />
        <ActionCard title={t("dashboard.admin.activity")} icon={BarChart3} />
      </div>
    </div>
  );
}
