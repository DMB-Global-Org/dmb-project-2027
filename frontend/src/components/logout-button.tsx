"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { gql } from "@/lib/graphql/client";
import { LOGOUT_MUTATION } from "@/lib/graphql/operations";
import { useApiErrorText } from "@/lib/use-api-error";

export function LogoutButton() {
  const t = useTranslations("common");
  const errorText = useApiErrorText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await gql(LOGOUT_MUTATION);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(errorText(error));
      setBusy(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" disabled={busy} onClick={logout}>
      {t("logout")}
    </Button>
  );
}
