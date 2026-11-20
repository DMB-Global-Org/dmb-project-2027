"use client";

import { CopyIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { gql } from "@/lib/graphql/client";
import {
  CREATE_INVITATION_MUTATION,
  REVOKE_INVITATION_MUTATION,
} from "@/lib/graphql/operations";
import type { Invitation, InvitationKind, InvitationStatus } from "@/lib/graphql/types";
import { errorField, useApiErrorText } from "@/lib/use-api-error";

interface Recommender {
  id: string;
  name: string;
  depth: number;
}

const LOCALES = ["pl", "de", "en"] as const;
const STATUS_VARIANT: Record<InvitationStatus, "default" | "secondary" | "outline"> = {
  PENDING: "default",
  USED: "secondary",
  EXPIRED: "outline",
};

export function InvitationsView({
  viewerId,
  isSuperAdmin,
  recommenders,
  invitations,
}: {
  viewerId: string;
  isSuperAdmin: boolean;
  recommenders: Recommender[];
  invitations: Invitation[];
}) {
  const t = useTranslations("invitations");
  const tf = useTranslations("fields");
  const tl = useTranslations("languages");
  const errorText = useApiErrorText();
  const format = useFormatter();
  const uiLocale = useLocale();
  const router = useRouter();

  const [kind, setKind] = useState<InvitationKind>("PARTNER");
  const [email, setEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // The link is shown only once, right after it was created.
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const when = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" });

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // currentTarget is gone after the first await.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    setBusy(true);
    setErrors({});
    setCreatedUrl(null);
    try {
      const { createInvitation } = await gql<{ createInvitation: { url: string } }>(
        CREATE_INVITATION_MUTATION,
        {
          input: {
            kind,
            recommenderId: kind === "PARTNER" ? value("recommenderId") || undefined : undefined,
            recipientEmail: value("recipientEmail") || undefined,
            recipientPhone: value("recipientPhone") || undefined,
            locale: value("locale"),
            sendEmail: sendEmail && Boolean(value("recipientEmail")),
          },
        },
      );
      setCreatedUrl(createInvitation.url);
      formElement.reset();
      setEmail("");
      setSendEmail(false);
      router.refresh();
    } catch (e) {
      setErrors({ [errorField(e) ?? "form"]: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  async function revoke(id: string) {
    try {
      await gql(REVOKE_INVITATION_MUTATION, { id });
      toast.success(t("revoked"));
      router.refresh();
    } catch (e) {
      toast.error(errorText(e));
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
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2" noValidate>
            {isSuperAdmin && (
              <FormField id="kind" label={tf("kind")}>
                <NativeSelect
                  id="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as InvitationKind)}
                >
                  <option value="PARTNER">{t("kindPartner")}</option>
                  <option value="PLATINUM">{t("kindPlatinum")}</option>
                </NativeSelect>
              </FormField>
            )}
            {kind === "PARTNER" && (
              <FormField
                id="recommenderId"
                label={tf("recommenderId")}
                error={errors.recommenderId}
              >
                <NativeSelect
                  id="recommenderId"
                  name="recommenderId"
                  defaultValue={isSuperAdmin ? "" : viewerId}
                  aria-invalid={invalid("recommenderId")}
                >
                  {isSuperAdmin && <option value="">–</option>}
                  {recommenders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {`${"– ".repeat(r.depth)}${r.name}`}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}
            <FormField
              id="recipientEmail"
              label={tf("recipientEmail")}
              error={errors.recipientEmail}
            >
              <Input
                id="recipientEmail"
                name="recipientEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={invalid("recipientEmail")}
              />
            </FormField>
            <FormField
              id="recipientPhone"
              label={tf("recipientPhone")}
              error={errors.recipientPhone}
            >
              <Input
                id="recipientPhone"
                name="recipientPhone"
                type="tel"
                aria-invalid={invalid("recipientPhone")}
              />
            </FormField>
            <FormField id="locale" label={tf("locale")}>
              <NativeSelect id="locale" name="locale" defaultValue={uiLocale}>
                {LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {tl(code)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <div className="flex items-end gap-2 pb-1.5">
              <Checkbox
                id="sendEmail"
                checked={sendEmail}
                disabled={!email.trim()}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
              />
              <Label htmlFor="sendEmail" className="font-normal">
                {t("sendEmail")}
              </Label>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              {errors.form && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.form}
                </p>
              )}
              <div>
                <Button type="submit" disabled={busy}>
                  {t("create")}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {createdUrl && (
        <Card className="border-gold">
          <CardHeader>
            <CardTitle>{t("linkTitle")}</CardTitle>
            <CardDescription>{t("linkOnce")}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input readOnly aria-label={t("linkTitle")} value={createdUrl} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" onClick={() => copy(createdUrl)}>
              <CopyIcon />
              {t("copy")}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("recipient")}</TableHead>
              <TableHead>{t("kind")}</TableHead>
              <TableHead>{t("created")}</TableHead>
              <TableHead>{t("expires")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell>{invitation.recipientEmail ?? invitation.recipientPhone ?? "–"}</TableCell>
                <TableCell>
                  {invitation.kind === "PLATINUM" ? t("kindPlatinum") : t("kindPartner")}
                </TableCell>
                <TableCell>{when(invitation.createdAt)}</TableCell>
                <TableCell>{when(invitation.expiresAt)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[invitation.status]}>
                    {t(`statuses.${invitation.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {invitation.status === "PENDING" && (
                    <Button variant="ghost" size="sm" onClick={() => revoke(invitation.id)}>
                      {t("revoke")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
