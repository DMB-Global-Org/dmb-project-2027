import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

/** Top bar of the pages before login: brand, language and theme. */
export function PublicHeader() {
  return (
    <header className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <span className="font-semibold tracking-wide text-gold">dMb Global</span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
