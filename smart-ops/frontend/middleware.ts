import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "jcp_session";
const PABARI_URL = "https://pabari-workspace.up.railway.app";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /sso is the only public path — login is disabled, all auth goes through Pabari SSO
  const isSsoPath = pathname === "/sso" || pathname.startsWith("/sso/");

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Unauthenticated: send back to Pabari workspace (not a local login page)
  if (!token && !isSsoPath) {
    return NextResponse.redirect(PABARI_URL);
  }

  // Anyone hitting /login gets bounced to dashboard (if authed) or Pabari (if not)
  if (pathname === "/login") {
    return NextResponse.redirect(token ? new URL("/dashboard", request.url) : PABARI_URL);
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
