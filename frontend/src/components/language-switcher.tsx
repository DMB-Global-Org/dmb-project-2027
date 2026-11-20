"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { LOCALES } from "@/i18n/config";

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("language")}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          aria-pressed={code === locale}
          onClick={() =>
            startTransition(async () => {
              await setLocale(code);
              router.refresh();
            })
          }
          className="rounded px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:text-foreground"
        >
          {code}
        </button>
      ))}
    </div>
  );
}
