import { getTranslations } from "next-intl/server";
import { MY_INVITATIONS_QUERY, STRUCTURE_QUERY } from "@/lib/graphql/operations";
import { serverGql } from "@/lib/graphql/server";
import { displayName, type Invitation, type StructureEntry } from "@/lib/graphql/types";
import { requireActiveViewer } from "@/lib/graphql/viewer";
import { InvitationsView } from "./invitations-view";

export default async function InvitationsPage() {
  const viewer = await requireActiveViewer();
  const t = await getTranslations("invitations");
  const [{ myInvitations }, { structure }] = await Promise.all([
    serverGql<{ myInvitations: Invitation[] }>(MY_INVITATIONS_QUERY),
    serverGql<{ structure: StructureEntry[] }>(STRUCTURE_QUERY),
  ]);

  // Whom the link may name as sponsor: activated people the caller can see.
  const recommenders = structure
    .filter(({ account }) => account.state === "ACTIVE")
    .map(({ depth, account }) => ({ id: account.id, name: displayName(account), depth }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <InvitationsView
        viewerId={viewer.id}
        isSuperAdmin={viewer.role === "SUPER_ADMINISTRATOR"}
        recommenders={recommenders}
        invitations={myInvitations}
      />
    </div>
  );
}
