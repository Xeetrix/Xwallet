import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "xwallet_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const PENDING_TOTP_COOKIE_NAME = "xwallet_2fa_pending";
const PENDING_TOTP_MAX_AGE_SECONDS = 5 * 60;

export type Role = "ADMIN" | "CLIENT";
export type UserStatus = "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";

export interface SessionPayload {
  sub: string;
  role: Role;
  status: UserStatus;
  fullName: string;
  email: string;
}

function getSecret() {
  const secret =
    process.env.JWT_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "xwallet-asia-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    // Unset by default (host-only cookie, works fine on a single domain).
    // Set COOKIE_DOMAIN=".xwallet.asia" to share the session between the
    // apex domain and www so a client isn't logged out switching between them.
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: SESSION_COOKIE_NAME,
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");
  return session;
}

/**
 * Re-validates the session against the database instead of trusting the
 * JWT's embedded role/status claims, which are only as fresh as the last
 * login — up to the cookie's 7-day lifetime. Used by client money-movement
 * actions (deposit, transfer, withdrawal, convert) so suspending an account
 * takes effect on its very next action rather than waiting for the
 * client's session to expire or be reissued.
 */
export async function requireFreshClientSession(): Promise<SessionPayload> {
  const session = await requireSession();

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { role: true, status: true },
  });
  if (!user) {
    await destroySessionCookie();
    redirect("/login");
  }

  return { ...session, role: user.role, status: user.status };
}

export interface PendingTotpPayload {
  sub: string;
}

/**
 * Short-lived, separate-cookie holding pattern for the gap between a
 * correct ADMIN password and a verified TOTP code — issuing the real
 * session cookie only happens after both. Five minutes is enough time to
 * open an authenticator app without leaving a long-lived half-authenticated
 * cookie sitting around.
 */
export async function createPendingTotpCookie(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TOTP_MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(PENDING_TOTP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_TOTP_MAX_AGE_SECONDS,
  });
}

export async function readPendingTotpCookie(): Promise<PendingTotpPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_TOTP_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as PendingTotpPayload;
  } catch {
    return null;
  }
}

export async function destroyPendingTotpCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: PENDING_TOTP_COOKIE_NAME, path: "/" });
}
