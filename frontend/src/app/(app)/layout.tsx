import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { requireViewer } from "@/lib/graphql/viewer";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  return (
    <>
      <AppHeader viewer={viewer} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
