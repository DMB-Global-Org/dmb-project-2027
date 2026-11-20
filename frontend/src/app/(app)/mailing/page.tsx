import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { MY_MAILINGS_QUERY } from "@/lib/graphql/operations";
import { serverGql } from "@/lib/graphql/server";
import { canSendMailing, type Mailing } from "@/lib/graphql/types";
import { requireActiveViewer } from "@/lib/graphql/viewer";
import { MailingView } from "./mailing-view";

export default async function MailingPage() {
  const viewer = await requireActiveViewer();
  // Ordinary partners do not send mailings; the server refuses them as well.
  if (!canSendMailing(viewer.role)) redirect("/accounts");
  const t = await getTranslations("mailing");
  const { myMailings } = await serverGql<{ myMailings: Mailing[] }>(MY_MAILINGS_QUERY);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <MailingView mailings={myMailings} />
    </div>
  );
}
