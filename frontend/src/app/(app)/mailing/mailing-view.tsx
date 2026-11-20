"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { gql } from "@/lib/graphql/client";
import { MAILING_AUDIENCE_QUERY, SEND_MAILING_MUTATION } from "@/lib/graphql/operations";
import { ROLES, type Mailing, type Role } from "@/lib/graphql/types";
import { errorField, useApiErrorText } from "@/lib/use-api-error";

/** Roles that can be the lowest one: nobody holds SuperAdministrator in an organization. */
const MIN_ROLES = ROLES.filter((role) => role !== "SUPER_ADMINISTRATOR");

export function MailingView({ mailings }: { mailings: Mailing[] }) {
  const t = useTranslations("mailing");
  const tf = useTranslations("fields");
  const tr = useTranslations("roles");
  const errorText = useApiErrorText();
  const format = useFormatter();
  const router = useRouter();

  const [minRole, setMinRole] = useState<Role>("GENERAL");
  const [audience, setAudience] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // How many people it would reach, for the chosen lowest role.
  useEffect(() => {
    let current = true;
    gql<{ mailingAudience: number }>(MAILING_AUDIENCE_QUERY, { minRole })
      .then((data) => current && setAudience(data.mailingAudience))
      .catch(() => current && setAudience(null));
    return () => {
      current = false;
    };
  }, [minRole, mailings.length]);

  /** Collects the form and asks for confirmation before anything is sent. */
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const name of ["subject", "body", "subjectDe", "bodyDe", "subjectEn", "bodyEn"]) {
      values[name] = String(form.get(name) ?? "").trim();
    }
    setErrors({});
    setDraft(values);
  }

  async function send() {
    if (!draft) return;
    setBusy(true);
    try {
      await gql(SEND_MAILING_MUTATION, {
        input: {
          subject: draft.subject,
          body: draft.body,
          subjectDe: draft.subjectDe || undefined,
          bodyDe: draft.bodyDe || undefined,
          subjectEn: draft.subjectEn || undefined,
          bodyEn: draft.bodyEn || undefined,
          minRole,
        },
      });
      toast.success(t("queued"));
      setDraft(null);
      document.querySelector<HTMLFormElement>("#mailing-form")?.reset();
      router.refresh();
    } catch (e) {
      setErrors({ [errorField(e) ?? "form"]: errorText(e) });
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  const invalid = (name: string) => (errors[name] ? true : undefined);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
          <CardDescription>{t("newHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="mailing-form" onSubmit={review} className="flex flex-col gap-4" noValidate>
            <FormField id="minRole" label={t("minRole")} hint={t("minRoleHint")}>
              <NativeSelect
                id="minRole"
                value={minRole}
                onChange={(e) => setMinRole(e.target.value as Role)}
              >
                {MIN_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {tr(role)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <p className="text-sm text-muted-foreground">
              {audience === null ? "" : t("audience", { count: audience })}
            </p>
            <FormField id="subject" label={tf("subject")} error={errors.subject}>
              <Input id="subject" name="subject" maxLength={200} required aria-invalid={invalid("subject")} />
            </FormField>
            <FormField id="body" label={tf("body")} error={errors.body}>
              <Textarea id="body" name="body" rows={8} required aria-invalid={invalid("body")} />
            </FormField>

            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">{t("translations")}</summary>
              <div className="mt-3 flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">{t("translationsHint")}</p>
                <FormField id="subjectDe" label={`${tf("subject")} (DE)`} error={errors.subjectDe}>
                  <Input id="subjectDe" name="subjectDe" maxLength={200} />
                </FormField>
                <FormField id="bodyDe" label={`${tf("body")} (DE)`} error={errors.bodyDe}>
                  <Textarea id="bodyDe" name="bodyDe" rows={5} aria-invalid={invalid("bodyDe")} />
                </FormField>
                <FormField id="subjectEn" label={`${tf("subject")} (EN)`} error={errors.subjectEn}>
                  <Input id="subjectEn" name="subjectEn" maxLength={200} />
                </FormField>
                <FormField id="bodyEn" label={`${tf("body")} (EN)`} error={errors.bodyEn}>
                  <Textarea id="bodyEn" name="bodyEn" rows={5} aria-invalid={invalid("bodyEn")} />
                </FormField>
              </div>
            </details>

            {errors.form && (
              <p role="alert" className="text-sm text-destructive">
                {errors.form}
              </p>
            )}
            <div>
              <Button type="submit" disabled={busy}>
                {t("review")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmText", { count: audience ?? 0, role: tr(minRole) })}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">{draft?.subject}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
            <Button disabled={busy} onClick={send}>
              {t("send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("subjectColumn")}</TableHead>
              <TableHead>{t("fromRole")}</TableHead>
              <TableHead>{t("recipients")}</TableHead>
              <TableHead>{t("delivery")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mailings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {mailings.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  {format.dateTime(new Date(m.createdAt), { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
                <TableCell className="font-medium">{m.subject}</TableCell>
                <TableCell>{tr(m.minRole)}</TableCell>
                <TableCell className="tabular-nums">{m.recipientCount}</TableCell>
                <TableCell className="tabular-nums text-sm">
                  {t("deliveryLine", { sent: m.sent, pending: m.pending, failed: m.failed })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
