import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCOUNT_QUERY, STRUCTURE_QUERY } from "@/lib/graphql/operations";
import { serverGql } from "@/lib/graphql/server";
import {
  displayName,
  type Account,
  type AccountState,
  type StructureEntry,
} from "@/lib/graphql/types";
import { requireActiveViewer } from "@/lib/graphql/viewer";
import { AccountActions } from "./account-actions";

const STATE_VARIANT: Record<AccountState, "default" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PENDING_ACTIVATION: "outline",
  DEACTIVATED: "destructive",
};

export default async function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  await requireActiveViewer();
  const [t, tr, ts, tst, { account }, { structure }] = await Promise.all([
    getTranslations("account"),
    getTranslations("roles"),
    getTranslations("statuses"),
    getTranslations("states"),
    // A malformed id is "not found" for the API as well.
    serverGql<{ account: Account | null }>(ACCOUNT_QUERY, { id }).catch(() => ({
      account: null,
    })),
    serverGql<{ structure: StructureEntry[] }>(STRUCTURE_QUERY),
  ]);
  if (!account) notFound();

  // The sponsor's name, when the caller can see them (people above stay hidden).
  const recommender = structure.find((e) => e.account.id === account.recommenderId)?.account;
  const rows: [string, string][] = [
    [t("email"), account.email],
    [t("phone"), account.phone ?? "–"],
    [
      t("partnerNumber"),
      account.partnerNumber
        ? `${account.partnerCountry ?? ""} ${account.partnerNumber}`.trim()
        : "–",
    ],
    [t("role"), tr(account.role)],
    [t("status"), ts(account.status)],
    [t("recommender"), recommender ? displayName(recommender) : "–"],
    [t("profile"), account.profileCompleted ? t("profileDone") : t("profileMissing")],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/accounts" className="text-sm text-muted-foreground hover:underline">
          ← {t("back")}
        </Link>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
          {displayName(account)}
          <Badge variant={STATE_VARIANT[account.state]}>{tst(account.state)}</Badge>
        </h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <AccountActions account={account} />
      </div>
    </div>
  );
}
