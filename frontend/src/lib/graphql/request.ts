import { ApiError, toApiErrorCode } from "./errors";

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
}

/**
 * Shared by the browser and the server client: posts one operation and turns a
 * GraphQL error into an `ApiError` carrying the machine-readable code.
 */
export async function postGraphQL<T>(
  url: string,
  query: string,
  variables: Record<string, unknown> | undefined,
  init: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      method: "POST",
      headers: { "content-type": "application/json", ...init.headers },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ApiError("NETWORK");
  }

  let body: GraphQLResponse<T>;
  try {
    body = (await response.json()) as GraphQLResponse<T>;
  } catch {
    throw new ApiError("UNKNOWN");
  }

  const error = body.errors?.[0];
  if (error) {
    const { code, ...details } = error.extensions ?? {};
    throw new ApiError(toApiErrorCode(code), details);
  }
  if (body.data == null) throw new ApiError("UNKNOWN");
  return body.data;
}
