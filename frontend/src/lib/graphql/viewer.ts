import { ApiError } from "./errors";
import { serverGql } from "./server";

export interface Viewer {
  id: string;
  email: string;
  locale: string;
}

/** The signed-in account, or null for a visitor (also when the API is down). */
export async function getViewer(): Promise<Viewer | null | "API_DOWN"> {
  try {
    const { viewer } = await serverGql<{ viewer: Viewer | null }>(
      "query { viewer { id email locale } }",
    );
    return viewer;
  } catch (error) {
    if (error instanceof ApiError && error.code === "NETWORK") return "API_DOWN";
    throw error;
  }
}
