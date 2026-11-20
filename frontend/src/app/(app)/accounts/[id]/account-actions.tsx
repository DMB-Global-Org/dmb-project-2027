"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { gql } from "@/lib/graphql/client";
import {
  ACTIVATE_MUTATION,
  CANDIDATES_QUERY,
  CHANGE_RECOMMENDER_MUTATION,
  CHANGE_ROLE_MUTATION,
  CHANGE_STATUS_MUTATION,
  DEACTIVATE_MUTATION,
  REMOVE_ACCOUNT_MUTATION,
  UPDATE_ACCOUNT_DATA_MUTATION,
  UPDATE_PARTNER_NUMBER_MUTATION,
} from "@/lib/graphql/operations";
import {
  displayName,
  PARTNER_STATUSES,
  type Account,
  type RecommenderCandidate,
} from "@/lib/graphql/types";
import { errorField, useApiErrorText } from "@/lib/use-api-error";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Alert({ text }: { text?: string }) {
  return text ? (
    <p role="alert" className="text-xs text-destructive">
      {text}
    </p>
  ) : null;
}

export function AccountActions({ account }: { account: Account }) {
  const t = useTranslations("account");
  const tf = useTranslations("fields");
  const tr = useTranslations("roles");
  const ts = useTranslations("statuses");
  const errorText = useApiErrorText();
  const router = useRouter();
  const allowed = new Set(account.allowedActions);

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickedRole, setRole] = useState(account.role);
  // The list changes after a role change; never keep a role that is not in it.
  const role = account.assignableRoles.includes(pickedRole)
    ? pickedRole
    : (account.assignableRoles[0] ?? account.role);
  const [status, setStatus] = useState(account.status);
  const [moveOpen, setMoveOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [candidates, setCandidates] = useState<RecommenderCandidate[]>([]);
  const [sponsorId, setSponsorId] = useState("");

  /** Runs one change; reports the result and reloads the page data. */
  async function run(
    key: string,
    action: () => Promise<unknown>,
    after?: () => void,
  ): Promise<boolean> {
    setBusy(true);
    setErrors({});
    try {
      await action();
      toast.success(t("saved"));
      if (after) after();
      else router.refresh();
      return true;
    } catch (e) {
      setErrors({ [errorField(e) ?? key]: errorText(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const id = account.id;
  const text = (form: FormData, name: string) =>
    String(form.get(name) ?? "").trim();

  function saveData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    return run("data", () =>
      gql(UPDATE_ACCOUNT_DATA_MUTATION, {
        id,
        input: {
          firstName: text(form, "firstName") || undefined,
          lastName: text(form, "lastName") || undefined,
          phone: text(form, "phone") || undefined,
        },
      }),
    );
  }

  function saveNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    return run("number", () =>
      gql(UPDATE_PARTNER_NUMBER_MUTATION, {
        id,
        input: {
          country: text(form, "country") || undefined,
          partnerNumber: text(form, "partnerNumber"),
        },
      }),
    );
  }

  async function openMove() {
    setErrors({});
    try {
      const { recommenderCandidates } = await gql<{
        recommenderCandidates: RecommenderCandidate[];
      }>(CANDIDATES_QUERY, { id });
      setCandidates(recommenderCandidates);
      setSponsorId(recommenderCandidates[0]?.id ?? "");
      setMoveOpen(true);
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  async function move() {
    const done = await run("move", () =>
      gql(CHANGE_RECOMMENDER_MUTATION, { id, recommenderId: sponsorId }),
    );
    if (done) setMoveOpen(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("actions")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {allowed.size === 0 && (
          <p className="text-sm text-muted-foreground">{t("noActions")}</p>
        )}

        {(allowed.has("ACTIVATE") || allowed.has("DEACTIVATE")) && (
          <Section title={t("stateSection")}>
            <div className="flex flex-wrap gap-2">
              {allowed.has("ACTIVATE") && (
                <Button
                  disabled={busy}
                  onClick={() => run("state", () => gql(ACTIVATE_MUTATION, { id }))}
                >
                  {t("activate")}
                </Button>
              )}
              {allowed.has("DEACTIVATE") && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => run("state", () => gql(DEACTIVATE_MUTATION, { id }))}
                >
                  {t("deactivate")}
                </Button>
              )}
            </div>
            <Alert text={errors.state} />
          </Section>
        )}

        {allowed.has("CHANGE_ROLE") && (
          <Section title={t("roleSection")}>
            <div className="flex gap-2">
              <NativeSelect
                aria-label={t("role")}
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                {account.assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </NativeSelect>
              <Button
                disabled={busy}
                onClick={() => run("role", () => gql(CHANGE_ROLE_MUTATION, { id, role }))}
              >
                {t("change")}
              </Button>
            </div>
            <Alert text={errors.role} />
          </Section>
        )}

        {allowed.has("CHANGE_STATUS") && (
          <Section title={t("statusSection")}>
            <div className="flex gap-2">
              <NativeSelect
                aria-label={t("status")}
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                {PARTNER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ts(s)}
                  </option>
                ))}
              </NativeSelect>
              <Button
                disabled={busy}
                onClick={() =>
                  run("status", () => gql(CHANGE_STATUS_MUTATION, { id, status }))
                }
              >
                {t("change")}
              </Button>
            </div>
            <Alert text={errors.status} />
          </Section>
        )}

        {allowed.has("UPDATE_ACCOUNT") && (
          <Section title={t("dataSection")}>
            <form onSubmit={saveData} className="grid gap-3 sm:grid-cols-2" noValidate>
              <FormField id="firstName" label={tf("firstName")} error={errors.firstName}>
                <Input id="firstName" name="firstName" defaultValue={account.firstName ?? ""} />
              </FormField>
              <FormField id="lastName" label={tf("lastName")} error={errors.lastName}>
                <Input id="lastName" name="lastName" defaultValue={account.lastName ?? ""} />
              </FormField>
              <div className="sm:col-span-2">
                <FormField id="phone" label={tf("phone")} error={errors.phone}>
                  <Input id="phone" name="phone" type="tel" defaultValue={account.phone ?? ""} />
                </FormField>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <div>
                  <Button type="submit" disabled={busy}>
                    {t("save")}
                  </Button>
                </div>
                <Alert text={errors.data} />
              </div>
            </form>
          </Section>
        )}

        {allowed.has("CHANGE_PARTNER_NUMBER") && (
          <Section title={t("numberSection")}>
            <form onSubmit={saveNumber} className="grid grid-cols-[6rem_1fr] gap-3" noValidate>
              <FormField id="country" label={tf("country")} error={errors.country}>
                <Input
                  id="country"
                  name="country"
                  maxLength={2}
                  className="uppercase"
                  defaultValue={account.partnerCountry ?? "PL"}
                />
              </FormField>
              <FormField
                id="partnerNumber"
                label={tf("partnerNumber")}
                error={errors.partnerNumber}
              >
                <Input
                  id="partnerNumber"
                  name="partnerNumber"
                  inputMode="numeric"
                  defaultValue={account.partnerNumber ?? ""}
                />
              </FormField>
              <div className="col-span-2 flex flex-col gap-2">
                <div>
                  <Button type="submit" disabled={busy}>
                    {t("save")}
                  </Button>
                </div>
                <Alert text={errors.number} />
              </div>
            </form>
          </Section>
        )}

        {(allowed.has("CHANGE_RECOMMENDER") || allowed.has("REMOVE_FROM_STRUCTURE")) && (
          <Section title={t("structureSection")}>
            <div className="flex flex-wrap gap-2">
              {allowed.has("CHANGE_RECOMMENDER") && (
                <Button variant="outline" disabled={busy} onClick={openMove}>
                  {t("changeRecommender")}
                </Button>
              )}
              {allowed.has("REMOVE_FROM_STRUCTURE") && (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setRemoveOpen(true)}
                >
                  {t("remove")}
                </Button>
              )}
            </div>
          </Section>
        )}
      </CardContent>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("changeRecommender")}</DialogTitle>
            <DialogDescription>
              {t("moveHint", { name: displayName(account) })}
            </DialogDescription>
          </DialogHeader>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCandidates")}</p>
          ) : (
            <NativeSelect
              aria-label={t("newRecommender")}
              value={sponsorId}
              onChange={(e) => setSponsorId(e.target.value)}
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${"– ".repeat(c.depth)}${displayName(c)}`}
                </option>
              ))}
            </NativeSelect>
          )}
          <Alert text={errors.move} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              {t("cancel")}
            </Button>
            <Button disabled={busy || !sponsorId} onClick={move}>
              {t("move")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeTitle", { name: displayName(account) })}</DialogTitle>
            <DialogDescription>{t("removeText")}</DialogDescription>
          </DialogHeader>
          <Alert text={errors.remove} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(
                  "remove",
                  () => gql(REMOVE_ACCOUNT_MUTATION, { id }),
                  () => {
                    setRemoveOpen(false);
                    router.replace("/accounts");
                    router.refresh();
                  },
                )
              }
            >
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
