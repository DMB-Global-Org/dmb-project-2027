import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STRUCTURE_QUERY } from "@/lib/graphql/operations";
import { serverGql } from "@/lib/graphql/server";
import { displayName, type AccountState, type StructureEntry } from "@/lib/graphql/types";
import { requireActiveViewer } from "@/lib/graphql/viewer";

const STATE_VARIANT: Record<AccountState, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PENDING_ACTIVATION: "outline",
  DEACTIVATED: "destructive",
};

export default async function AccountsPage() {
  await requireActiveViewer();
  const [t, tr, ts, tst, { structure }] = await Promise.all([
    getTranslations("accounts"),
    getTranslations("roles"),
    getTranslations("statuses"),
    getTranslations("states"),
    serverGql<{ structure: StructureEntry[] }>(STRUCTURE_QUERY),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("person")}</TableHead>
              <TableHead>{t("partnerNumber")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("state")}</TableHead>
              <TableHead>{t("profile")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {structure.map(({ depth, account }) => (
              <TableRow key={account.id}>
                <TableCell>
                  {/* Indentation shows who stands below whom. */}
                  <div style={{ paddingLeft: `${depth * 1.25}rem` }}>
                    <div className="font-medium">{displayName(account)}</div>
                    {(account.firstName || account.lastName) && (
                      <div className="text-xs text-muted-foreground">{account.email}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  {account.partnerNumber
                    ? `${account.partnerCountry ?? ""} ${account.partnerNumber}`.trim()
                    : "–"}
                </TableCell>
                <TableCell>{tr(account.role)}</TableCell>
                <TableCell>{ts(account.status)}</TableCell>
                <TableCell>
                  <Badge variant={STATE_VARIANT[account.state]}>{tst(account.state)}</Badge>
                </TableCell>
                <TableCell>
                  {account.profileCompleted ? t("profileDone") : t("profileMissing")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
