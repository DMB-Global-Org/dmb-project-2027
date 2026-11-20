import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { canSendMailing, type Viewer } from "@/lib/graphql/types";

/** Top bar of the signed-in application. */
export async function AppHeader({ viewer }: { viewer: Viewer }) {
  const t = await getTranslations("nav");
  const tr = await getTranslations("roles");
  const active = viewer.state === "ACTIVE";

  return (
    <header className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold tracking-wide text-gold">
          dMb Global
        </Link>
        <nav className="flex flex-1 items-center gap-4 text-sm">
          {active && <Link href="/accounts">{t("accounts")}</Link>}
          {active && <Link href="/invitations">{t("invitations")}</Link>}
          {active && canSendMailing(viewer.role) && <Link href="/mailing">{t("mailing")}</Link>}
          <Link href="/profile">{t("profile")}</Link>
        </nav>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden sm:inline">
            {viewer.email} · {tr(viewer.role)}
          </span>
          <LanguageSwitcher />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
