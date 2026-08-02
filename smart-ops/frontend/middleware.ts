import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// UX-level flag only — see lib/auth.ts. Real authorization is enforced by
// the backend independently via its own httpOnly cookie.
const AUTH_COOKIE_NAME = "jcp_session";
const PUBLIC_PATHS = ["/login", "/sso"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - static/image optimization files
     * - favicon and other public assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
