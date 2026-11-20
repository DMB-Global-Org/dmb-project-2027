import { getTranslations } from "next-intl/server";
import { frontendVersion, getBackendVersion } from "@/lib/version";

/** "version [frontend] | [backend]" in small type, under the logo. */
export async function VersionLabel() {
  const [t, backend] = await Promise.all([
    getTranslations("common"),
    getBackendVersion(),
  ]);
  return (
    <span className="block text-[0.65rem] font-normal leading-tight tracking-normal text-sidebar-foreground/60">
      {t("version")} {frontendVersion} | {backend ?? "–"}
    </span>
  );
}
