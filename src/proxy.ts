import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIdentity } from "../cursor/identity";

/**
 * Block unsigned viewers before page data loaders run.
 * Inbound email + due-task cron keep their own shared-secret auth.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/inbound") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/signed-out" ||
    pathname === "/favicon.ico"
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
  matcher: ["/((?!_next/static|_next/image|.*\\..*$).*)"],
};
