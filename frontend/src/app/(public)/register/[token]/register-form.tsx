"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gql } from "@/lib/graphql/client";
import { REGISTER_MUTATION } from "@/lib/graphql/operations";
import { errorField, useApiErrorText } from "@/lib/use-api-error";

export function RegisterForm({
  token,
  defaultEmail,
}: {
  token: string;
  defaultEmail: string;
}) {
  const t = useTranslations("register");
  const tf = useTranslations("fields");
  const errorText = useApiErrorText();
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");

    if (value("password") !== value("passwordConfirmation")) {
      setErrors({ passwordConfirmation: t("mismatch") });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await gql(REGISTER_MUTATION, {
        input: {
          token,
          email: value("email").trim(),
          password: value("password"),
          passwordConfirmation: value("passwordConfirmation"),
          country: value("country").trim() || undefined,
          partnerNumber: value("partnerNumber"),
        },
      });
      // The API logged us in: the profile is the first step.
      router.replace("/profile");
      router.refresh();
    } catch (e) {
      const field = errorField(e) ?? "form";
      setErrors({ [field]: errorText(e) });
      setBusy(false);
    }
  }

  const invalid = (name: string) => (errors[name] ? true : undefined);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormField id="email" label={tf("email")} error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={defaultEmail}
          required
          aria-invalid={invalid("email")}
        />
      </FormField>
      <FormField id="password" label={tf("password")} error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={invalid("password")}
        />
      </FormField>
      <FormField
        id="passwordConfirmation"
        label={tf("passwordConfirmation")}
        error={errors.passwordConfirmation}
      >
        <Input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={invalid("passwordConfirmation")}
        />
      </FormField>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <FormField id="country" label={tf("country")} error={errors.country}>
          <Input
            id="country"
            name="country"
            defaultValue="PL"
            maxLength={2}
            className="uppercase"
            aria-invalid={invalid("country")}
          />
        </FormField>
        <FormField
          id="partnerNumber"
          label={tf("partnerNumber")}
          hint={t("partnerNumberHint")}
          error={errors.partnerNumber}
        >
          <Input
            id="partnerNumber"
            name="partnerNumber"
            inputMode="numeric"
            required
            aria-invalid={invalid("partnerNumber")}
          />
        </FormField>
      </div>
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}
