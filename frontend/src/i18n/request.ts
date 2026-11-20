import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";

// Locale comes from a cookie (no locale in the URL). Messages of a missing
// language fall back to Polish, so a new language needs only a new JSON file.
export default getRequestConfig(async () => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
  const fallback = (await import(`../../messages/${DEFAULT_LOCALE}.json`))
    .default;
  const messages =
    locale === DEFAULT_LOCALE
      ? fallback
      : { ...fallback, ...(await import(`../../messages/${locale}.json`)).default };
  return { locale, messages };
});
