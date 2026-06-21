import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  Radio,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/ai-performance")({
  component: AIPerformancePage,
});

type LogRow = {
  id: string;
  facility: string;
  model: string;
  latency_ms: number;
  confidence_score: number | null;
  validated_by_specialist: boolean | null;
  specialist_agrees: boolean | null;
  created_at: string;
};

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

function AIPerformancePage() {
  const { user, role, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && role && role !== "admin" && role !== "specialiste") {
      navigate({ to: "/dashboard" });
    }
  }, [loading, user, role, navigate]);

  // Initial load
  useEffect(() => {
    if (!user || (role !== "admin" && role !== "specialiste")) return;
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    supabase
      .from("ai_diagnostics_logs")
      .select(
        "id, facility, model, latency_ms, confidence_score, validated_by_specialist, specialist_agrees, created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
        } else {
          setLogs(data as LogRow[]);
        }
        setLoadingLogs(false);
      });
  }, [user, role]);

  // Realtime subscription
  useEffect(() => {
    if (!user || (role !== "admin" && role !== "specialiste")) return;
    const channel = supabase
      .channel("ai_diagnostics_logs_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_diagnostics_logs" },
        (payload) => {
          setLogs((prev) => {
            const next = prev ? [payload.new as LogRow, ...prev] : [payload.new as LogRow];
            return next.slice(0, 1000);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_diagnostics_logs" },
        (payload) => {
          setLogs((prev) =>
            prev
              ? prev.map((l) => (l.id === (payload.new as LogRow).id ? (payload.new as LogRow) : l))
              : prev,
          );
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  const kpis = useMemo(() => computeKpis(logs ?? []), [logs]);

  if (loading || !user || (role !== "admin" && role !== "specialiste")) {
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
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("dashboard.welcome")}
        </Link>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {t("aiperf.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {role === "admin" ? t("aiperf.intro.admin") : t("aiperf.intro.specialist")}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`gap-1.5 px-3 py-1 ${
              live
                ? "border-success/30 bg-success-soft text-success"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            <Radio className={`h-3 w-3 ${live ? "animate-pulse" : ""}`} />
            <span className="text-xs font-medium">
              {live ? t("aiperf.live") : t("aiperf.connecting")}
            </span>
          </Badge>
        </div>

        {loadingLogs ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label={t("aiperf.kpi.diagnostics")}
                value={kpis.total.toString()}
                icon={Brain}
                tone="primary"
              />
              <Kpi
                label={t("aiperf.kpi.accuracy")}
                value={kpis.accuracy != null ? `${(kpis.accuracy * 100).toFixed(1)}%` : "—"}
                icon={CheckCircle2}
                tone="success"
              />
              <Kpi
                label={t("aiperf.kpi.latencyP50")}
                value={kpis.p50 != null ? `${kpis.p50} ms` : "—"}
                icon={Clock}
                tone="primary"
              />
              <Kpi
                label={t("aiperf.kpi.latencyP95")}
                value={kpis.p95 != null ? `${kpis.p95} ms` : "—"}
                icon={Gauge}
                tone="warning"
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi
                label={t("aiperf.kpi.confidence")}
                value={
                  kpis.avgConfidence != null
                    ? `${(kpis.avgConfidence * 100).toFixed(1)}%`
                    : "—"
                }
                icon={TrendingUp}
                tone="success"
              />
              <Kpi
                label={t("aiperf.kpi.validation")}
                value={
                  kpis.validationRate != null
                    ? `${(kpis.validationRate * 100).toFixed(0)}%`
                    : "—"
                }
                icon={CheckCircle2}
                tone="primary"
              />
              <Kpi
                label={t("aiperf.kpi.facilities")}
                value={kpis.facilities.toString()}
                icon={Activity}
                tone="primary"
              />
            </div>

            <div className="mt-10">
              <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">
                {t("aiperf.recent")}
              </h2>
              <div className="rounded-xl border border-border/60 bg-card shadow-soft">
                <div className="grid grid-cols-12 gap-3 border-b border-border/60 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <div className="col-span-3">{t("aiperf.col.time")}</div>
                  <div className="col-span-3 hidden md:block">{t("auth.facility")}</div>
                  <div className="col-span-2 hidden md:block">{t("aiperf.col.model")}</div>
                  <div className="col-span-2">{t("aiperf.col.latency")}</div>
                  <div className="col-span-2">{t("aiperf.col.confidence")}</div>
                </div>
                {!logs || logs.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    {t("aiperf.empty")}
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {logs.slice(0, 25).map((l) => (
                      <li
                        key={l.id}
                        className="grid grid-cols-12 items-center gap-3 px-5 py-3 text-sm"
                      >
                        <div className="col-span-3 text-muted-foreground">
                          {new Date(l.created_at).toLocaleTimeString()}
                        </div>
                        <div className="col-span-3 hidden truncate md:block">
                          {l.facility || "—"}
                        </div>
                        <div className="col-span-2 hidden truncate text-muted-foreground md:block">
                          {l.model}
                        </div>
                        <div className="col-span-2 font-mono text-xs">{l.latency_ms} ms</div>
                        <div className="col-span-2 font-mono text-xs">
                          {l.confidence_score != null
                            ? `${(l.confidence_score * 100).toFixed(0)}%`
                            : "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning";
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning/20 text-warning-foreground",
  }[tone];
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function computeKpis(logs: LogRow[]) {
  const total = logs.length;
  const latencies = logs.map((l) => l.latency_ms).sort((a, b) => a - b);
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);

  const validated = logs.filter((l) => l.validated_by_specialist === true);
  const accuracy =
    validated.length > 0
      ? validated.filter((l) => l.specialist_agrees === true).length / validated.length
      : null;

  const validationRate = total > 0 ? validated.length / total : null;

  const confs = logs
    .map((l) => l.confidence_score)
    .filter((c): c is number => c != null);
  const avgConfidence =
    confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : null;

  const facilities = new Set(logs.map((l) => l.facility).filter(Boolean)).size;

  return { total, p50, p95, accuracy, validationRate, avgConfidence, facilities };
}
