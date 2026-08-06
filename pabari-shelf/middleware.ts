import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PABARI_HUB = process.env.NEXT_PUBLIC_PABARI_URL ?? "https://pabari-workspace.up.railway.app";
const SESSION_COOKIE = "shelf_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = pathname === "/sso" || pathname.startsWith("/api/auth/");

  if (isPublic) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return NextResponse.redirect(PABARI_HUB);

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
