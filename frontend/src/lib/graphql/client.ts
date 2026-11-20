import { postGraphQL } from "./request";

/**
 * Browser client. Calls /api/graphql on our own origin (Next proxies it to the
 * backend), so the HttpOnly session cookie travels as a first-party cookie.
 */
export function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return postGraphQL<T>("/api/graphql", query, variables, {
    credentials: "same-origin",
  });
}
