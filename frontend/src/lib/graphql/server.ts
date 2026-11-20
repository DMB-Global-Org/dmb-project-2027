import "server-only";
import { cookies } from "next/headers";
import { postGraphQL } from "./request";

const apiUrl = (process.env.API_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);

/**
 * Server Components client: calls the backend directly and forwards the
 * visitor's cookies, so `viewer` and the other queries see the same session.
 * Never cached, the answer depends on who is asking.
 */
export async function serverGql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  return postGraphQL<T>(`${apiUrl}/graphql`, query, variables, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}
