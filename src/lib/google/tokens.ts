import { eq } from "drizzle-orm";
import {
  getDb,
  googleCalendarAccounts,
  type GoogleCalendarAccount,
} from "@/db";
import {
  googleClientId,
  googleClientSecret,
  googleRedirectUri,
} from "@/lib/google/config";

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

/** Returns a usable access token, refreshing and persisting when needed. */
export async function getValidAccessToken(
  account: GoogleCalendarAccount,
): Promise<string> {
  const expiresAt = account.accessTokenExpiresAt?.getTime() ?? 0;
  if (
    account.accessToken &&
    expiresAt > Date.now() + 60_000
  ) {
    return account.accessToken;
  }

  const tokens = await refreshAccessToken(account.refreshToken);
  const db = await getDb({ system: true });
  const expires = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;
  await db
    .update(googleCalendarAccounts)
    .set({
      accessToken: tokens.access_token,
      accessTokenExpiresAt: expires,
      refreshToken: tokens.refresh_token ?? account.refreshToken,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendarAccounts.userId, account.userId));
  return tokens.access_token;
}
