import "server-only";
import { cache } from "react";
import pkg from "../../package.json";
import { serverGql } from "./graphql/server";

/** Version of this frontend (frontend/package.json). */
export const frontendVersion: string = pkg.version;

/** Version of the running backend (its package.json), or null when it cannot be reached. */
export const getBackendVersion = cache(async (): Promise<string | null> => {
  try {
    return (await serverGql<{ version: string }>("query { version }")).version;
  } catch {
    return null;
  }
});
