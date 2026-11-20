import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getViewer } from "@/lib/graphql/viewer";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const [t, viewer] = await Promise.all([getTranslations("login"), getViewer()]);
  if (viewer && viewer !== "API_DOWN") redirect("/");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
