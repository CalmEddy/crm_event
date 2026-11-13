import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIdentity } from "../cursor/identity";

const STATIC_EXT =
  /\.(?:ico|png|jpg|jpeg|gif|svg|webp|css|js|map|txt|xml|woff2?|ttf|eot)$/i;

/**
 * Block unsigned viewers before page data loaders run.
 * Inbound email + due-task cron keep their own shared-secret auth.
 *
 * Matcher must still run for paths like /contacts/1.0 (dots in segments).
 * Only skip known static asset extensions and Next internals.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    STATIC_EXT.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/inbound") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/signed-out"
  ) {
    return NextResponse.next();
  }

  const identity = await getIdentity(request);
  if (identity.verified) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/signed-out";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
