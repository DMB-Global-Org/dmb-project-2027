import { redirect } from "next/navigation";
import { getViewer } from "@/lib/graphql/viewer";
import { ApiError } from "@/lib/graphql/errors";

// Entry point: sends everybody where they belong.
export default async function Home() {
  const viewer = await getViewer();
  if (viewer === "API_DOWN") throw new ApiError("NETWORK");
  if (!viewer) redirect("/login");
  redirect(viewer.state === "ACTIVE" ? "/accounts" : "/profile");
}
