import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Brain, FileHeart, Globe2, Network, ShieldCheck, Stethoscope, UserPlus, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" aria-hidden />
        <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-soft" aria-hidden />

        <div className="container relative mx-auto max-w-6xl px-4 pt-20 pb-24 md:pt-32 md:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              {t("app.tagline")}
            </div>

            <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              {t("hero.subtitle")}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="group h-12 px-6 shadow-glow">
                <Link to="/auth">
                  {t("hero.cta.primary")}
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-12 px-6">
                <a href="#modules">{t("hero.cta.secondary")}</a>
              </Button>
            </div>
          </div>

          {/* Visual mock card */}
          <div className="mx-auto mt-20 max-w-4xl">
            <div className="relative rounded-2xl border border-border bg-card/80 p-1 shadow-elevated backdrop-blur">
              <div className="rounded-xl bg-gradient-soft p-8 md:p-10">
                <div className="grid gap-6 md:grid-cols-3">
                  <MockStat icon={UserPlus} label={t("dashboard.stats.patients")} value="1 248" tone="primary" />
                  <MockStat icon={Brain} label={t("dashboard.stats.diagnostics")} value="892" tone="success" />
                  <MockStat icon={ShieldCheck} label={t("dashboard.stats.resolved")} value="94%" tone="warning" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 bg-background py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {t("features.title")}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={Brain} title={t("features.ai.title")} desc={t("features.ai.desc")} />
            <FeatureCard icon={FileHeart} title={t("features.records.title")} desc={t("features.records.desc")} />
            <FeatureCard icon={Network} title={t("features.network.title")} desc={t("features.network.desc")} />
            <FeatureCard icon={Globe2} title={t("features.multilang.title")} desc={t("features.multilang.desc")} />
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="border-t border-border/60 bg-gradient-soft py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {t("modules.title")}
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <ModuleCard icon={Stethoscope} title={t("modules.agent.title")} desc={t("modules.agent.desc")} accent="primary" />
            <ModuleCard icon={Activity} title={t("modules.specialiste.title")} desc={t("modules.specialiste.desc")} accent="success" />
            <ModuleCard icon={ShieldCheck} title={t("modules.admin.title")} desc={t("modules.admin.desc")} accent="warning" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background py-10">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-hero">
              <Activity className="h-3 w-3 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-medium text-foreground">{t("app.name")}</span>
          </div>
          <p>© {new Date().getFullYear()} — {t("footer.rights")}</p>
        </div>
      </footer>
    </div>
  );
}

function MockStat({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: "primary" | "success" | "warning" }) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning/20 text-warning-foreground",
  }[tone];
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: typeof Activity; title: string; desc: string }) {
  return (
    <div className="group rounded-xl border border-border/60 bg-card p-6 shadow-soft transition-all hover:border-primary/30 hover:shadow-elevated">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary transition-transform group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function ModuleCard({ icon: Icon, title, desc, accent }: { icon: typeof Activity; title: string; desc: string; accent: "primary" | "success" | "warning" }) {
  const accentClass = {
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
  }[accent];
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-soft transition-all hover:shadow-elevated">
      <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl ${accentClass} shadow-soft`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
