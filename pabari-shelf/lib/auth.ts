import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "shelf_session";
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "fallback-dev-secret");

export type ShelfUser = { email: string; name: string; role: string };

export async function createSession(user: ShelfUser): Promise<void> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(SECRET);

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
}

export async function getSession(): Promise<ShelfUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as ShelfUser;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { maxAge: 0, path: "/" });
}
