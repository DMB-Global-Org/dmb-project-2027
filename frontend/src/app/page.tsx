import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getViewer } from "@/lib/graphql/viewer";

// The page depends on the visitor's session cookie.
export default async function Home() {
  const [t, tc, viewer] = await Promise.all([
    getTranslations("home"),
    getTranslations("app"),
    getViewer(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between bg-sidebar px-6 py-3 text-sidebar-foreground">
        <span className="font-semibold tracking-wide text-gold">dMb Global</span>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{tc("tagline")}</p>
        <p>
          {viewer === "API_DOWN"
            ? t("apiDown")
            : viewer
              ? t("signedIn", { email: viewer.email })
              : t("signedOut")}
        </p>
      </main>
    </div>
  );
}
