import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { serverGql } from "@/lib/graphql/server";
import { INVITATION_PREVIEW_QUERY } from "@/lib/graphql/operations";
import type { InvitationPreview } from "@/lib/graphql/types";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  params,
}: PageProps<"/register/[token]">) {
  const { token } = await params;
  const [t, { invitation }] = await Promise.all([
    getTranslations("register"),
    serverGql<{ invitation: InvitationPreview | null }>(
      INVITATION_PREVIEW_QUERY,
      { token },
    ),
  ]);

  // Unknown, expired, used or revoked: the API does not say which.
  if (!invitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("invalidTitle")}</CardTitle>
          <CardDescription>{t("invalidText")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {invitation.kind === "PLATINUM" ? t("titlePlatinum") : t("title")}
        </CardTitle>
        <CardDescription>{t("intro")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm token={token} defaultEmail={invitation.recipientEmail ?? ""} />
      </CardContent>
    </Card>
  );
}
