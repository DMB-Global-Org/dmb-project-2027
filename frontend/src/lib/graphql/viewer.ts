import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiError } from "./errors";
import { VIEWER_QUERY } from "./operations";
import { serverGql } from "./server";
import type { Viewer } from "./types";

export type { Viewer };

/** The signed-in account, or null for a visitor; "API_DOWN" when the backend is unreachable. */
// Cached per request: the layout and the page both ask.
export const getViewer = cache(async (): Promise<Viewer | null | "API_DOWN"> => {
  try {
    const { viewer } = await serverGql<{ viewer: Viewer | null }>(VIEWER_QUERY);
    return viewer;
  } catch (error) {
    if (error instanceof ApiError && error.code === "NETWORK") return "API_DOWN";
    throw error;
  }
});

/** For pages behind the login: a visitor is sent to /login. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer === "API_DOWN") throw new ApiError("NETWORK");
  if (!viewer) redirect("/login");
  return viewer;
}

/** For pages that need an activated account: one still awaiting activation only has /profile. */
export async function requireActiveViewer(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.state !== "ACTIVE") redirect("/profile");
  return viewer;
}
