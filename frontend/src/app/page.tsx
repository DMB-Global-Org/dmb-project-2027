import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/lib/graphql/viewer";

// Welcome page for visitors. Somebody who is already signed in goes straight
// to where they belong.
export default async function Home() {
  const [t, tc, viewer] = await Promise.all([
    getTranslations("home"),
    getTranslations("app"),
    getViewer(),
  ]);
  if (viewer && viewer !== "API_DOWN") {
    redirect(viewer.state === "ACTIVE" ? "/accounts" : "/profile");
  }

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{tc("tagline")}</p>
        <p>{viewer === "API_DOWN" ? t("apiDown") : t("signedOut")}</p>
        <div>
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            {t("login")}
          </Link>
        </div>
      </main>
    </div>
  );
}
