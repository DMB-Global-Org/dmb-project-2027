"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gql } from "@/lib/graphql/client";
import { LOGIN_MUTATION } from "@/lib/graphql/operations";
import { useApiErrorText } from "@/lib/use-api-error";

export function LoginForm() {
  const t = useTranslations("login");
  const tf = useTranslations("fields");
  const errorText = useApiErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await gql(LOGIN_MUTATION, {
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormField id="email" label={tf("email")}>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </FormField>
      <FormField id="password" label={tf("password")} error={error}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
        />
      </FormField>
      <Button type="submit" disabled={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}
