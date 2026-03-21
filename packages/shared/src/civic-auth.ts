/**
 * Civic Auth client-credentials token helper.
 *
 * Exchanges CIVIC_CLIENT_ID + CIVIC_API_KEY for a short-lived JWT from
 * Civic's hosted OIDC service (https://auth.civic.com/oauth/token) and
 * caches it until 60 seconds before expiry.
 *
 * Returns null when credentials are absent or the exchange fails — callers
 * treat null as "skip auth header", which will result in a 401 from
 * civic-mcp (handled gracefully by the fail-open fallback in each agent).
 */

const CIVIC_TOKEN_ENDPOINT = "https://auth.civic.com/oauth/token";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type TokenCache = {
  token: string;
  expiresAt: number;
};

let cache: TokenCache | null = null;
let inflightRequest: Promise<string | null> | null = null;

export async function getCivicToken(): Promise<string | null> {
  if (cache && Date.now() < cache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return cache.token;
  }

  // Deduplicate concurrent calls - only one token request in flight at a time.
  if (inflightRequest) return inflightRequest;

  inflightRequest = fetchToken().finally(() => {
    inflightRequest = null;
  });

  return inflightRequest;
}

/**
 * Builds the standard headers object for requests to civic-mcp.
 * Sets Content-Type and conditionally adds Authorization if a token is available.
 */
export async function buildCivicHeaders(): Promise<Record<string, string>> {
  const token = await getCivicToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchToken(): Promise<string | null> {
  const clientId = process.env.CIVIC_CLIENT_ID?.trim();
  const apiKey = process.env.CIVIC_API_KEY?.trim();

  if (!clientId || !apiKey) return null;

  try {
    const response = await fetch(CIVIC_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: apiKey,
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      console.warn(
        `[civic-auth] token request failed: HTTP ${response.status}`
      );
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    cache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1_000,
    };

    return cache.token;
  } catch (err) {
    console.warn(
      "[civic-auth] failed to obtain token:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
