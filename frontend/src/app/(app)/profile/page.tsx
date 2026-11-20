import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MY_PROFILE_QUERY } from "@/lib/graphql/operations";
import { serverGql } from "@/lib/graphql/server";
import type { MyProfile } from "@/lib/graphql/types";
import { requireViewer } from "@/lib/graphql/viewer";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const viewer = await requireViewer();
  const t = await getTranslations("profile");
  const { myProfile } = await serverGql<{ myProfile: MyProfile | null }>(MY_PROFILE_QUERY);

  // A SuperAdministrator has no Partner profile.
  if (!myProfile) {
    return <p className="text-muted-foreground">{t("none", { email: viewer.email })}</p>;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      {myProfile.state === "PENDING_ACTIVATION" && (
        <p className="rounded-lg border border-gold bg-accent p-3 text-sm text-accent-foreground">
          {myProfile.profileCompletedAt ? t("waitingActivation") : t("fillIn")}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>{myProfile.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={myProfile} />
        </CardContent>
      </Card>
    </div>
  );
}
