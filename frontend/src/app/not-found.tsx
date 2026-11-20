import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p>{t("NOT_FOUND")}</p>
      <Link href="/" className="text-sm underline">
        dMb Global
      </Link>
    </main>
  );
}
