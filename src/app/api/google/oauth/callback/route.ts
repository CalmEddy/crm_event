import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb, googleCalendarAccounts } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { googleConfigured } from "@/lib/google/config";
import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from "@/lib/google/tokens";
import { appBaseUrl } from "@/lib/notifications/resend-send";

const STATE_COOKIE = "google_oauth_state";

function redirectToSettings(query: string) {
  return NextResponse.redirect(new URL(`/settings/calendar?${query}`, appBaseUrl()));
}

export async function GET(request: Request) {
  await requireSignedIn();
  if (!googleConfigured()) {
    return redirectToSettings("error=not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return redirectToSettings(`error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return redirectToSettings("error=missing_code");
  }

  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (!expected || expected !== state) {
    return redirectToSettings("error=invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token && !tokens.access_token) {
      return redirectToSettings("error=no_tokens");
    }

    const userId = await getCurrentUserId();
    if (!userId) return redirectToSettings("error=no_user");

    const db = await getDb();
    const [existing] = await db
      .select()
      .from(googleCalendarAccounts)
      .where(eq(googleCalendarAccounts.userId, userId));

    const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
    if (!refreshToken) {
      return redirectToSettings("error=no_refresh_token");
    }

    const email = tokens.access_token
      ? await fetchGoogleEmail(tokens.access_token)
      : null;
    const expires = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await db
      .insert(googleCalendarAccounts)
      .values({
        userId,
        googleEmail: email,
        refreshToken,
        accessToken: tokens.access_token ?? null,
        accessTokenExpiresAt: expires,
        enabled: true,
        lastError: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: googleCalendarAccounts.userId,
        set: {
          googleEmail: email ?? existing?.googleEmail ?? null,
          refreshToken,
          accessToken: tokens.access_token ?? existing?.accessToken ?? null,
          accessTokenExpiresAt: expires,
          enabled: true,
          lastError: null,
          updatedAt: new Date(),
        },
      });

    return redirectToSettings("connected=1");
  } catch (err) {
    console.error("[google-oauth]", err);
    return redirectToSettings(
      `error=${encodeURIComponent(err instanceof Error ? err.message : "oauth_failed")}`,
    );
  }
}
