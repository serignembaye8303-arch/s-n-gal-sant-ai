import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
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

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("nav.features")}
          </a>
          <a href="#modules" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("nav.modules")}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <Button asChild size="sm">
              <Link to="/dashboard">{t("nav.getstarted")}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">{t("nav.signin")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth">{t("nav.getstarted")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
