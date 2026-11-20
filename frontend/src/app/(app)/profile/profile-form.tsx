"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gql } from "@/lib/graphql/client";
import { UPDATE_PROFILE_MUTATION } from "@/lib/graphql/operations";
import type { MyProfile } from "@/lib/graphql/types";
import { errorField, useApiErrorText } from "@/lib/use-api-error";

export function ProfileForm({ profile }: { profile: MyProfile }) {
  const t = useTranslations("profile");
  const tf = useTranslations("fields");
  const errorText = useApiErrorText();
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(Boolean(profile.consentsAcceptedAt));
  const [busy, setBusy] = useState(false);
  const consentsLocked = Boolean(profile.consentsAcceptedAt);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    setBusy(true);
    setErrors({});
    try {
      await gql(UPDATE_PROFILE_MUTATION, {
        input: {
          firstName: value("firstName") || undefined,
          lastName: value("lastName") || undefined,
          phone: value("phone") || undefined,
          acceptConsents: consent || undefined,
        },
      });
      toast.success(t("saved"));
      router.refresh();
    } catch (e) {
      setErrors({ [errorField(e) ?? "form"]: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  const invalid = (name: string) => (errors[name] ? true : undefined);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="firstName" label={tf("firstName")} error={errors.firstName}>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            defaultValue={profile.firstName ?? ""}
            aria-invalid={invalid("firstName")}
          />
        </FormField>
        <FormField id="lastName" label={tf("lastName")} error={errors.lastName}>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            defaultValue={profile.lastName ?? ""}
            aria-invalid={invalid("lastName")}
          />
        </FormField>
      </div>
      <FormField
        id="phone"
        label={tf("phone")}
        hint={t("phoneHint")}
        error={errors.phone}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={profile.phone ?? ""}
          aria-invalid={invalid("phone")}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="partnerNumber" label={tf("partnerNumber")} hint={t("lockedHint")}>
          <Input
            id="partnerNumber"
            readOnly
            disabled
            value={
              profile.partnerNumber
                ? `${profile.partnerCountry ?? ""} ${profile.partnerNumber}`.trim()
                : ""
            }
          />
        </FormField>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="consents"
          checked={consent}
          disabled={consentsLocked}
          onCheckedChange={(checked) => setConsent(checked === true)}
        />
        <Label htmlFor="consents" className="font-normal leading-snug">
          {t("consents")}
        </Label>
      </div>
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {t("save")}
      </Button>
    </form>
  );
}
