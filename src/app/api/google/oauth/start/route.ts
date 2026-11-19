import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireSignedIn } from "@/lib/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/google/config";
import { appBaseUrl } from "@/lib/notifications/resend-send";

const STATE_COOKIE = "google_oauth_state";

export async function GET() {
  await requireSignedIn();
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/calendar?error=not_configured", appBaseUrl()),
    );
  }

  const state = randomBytes(24).toString("hex");
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(googleAuthUrl(state));
}
