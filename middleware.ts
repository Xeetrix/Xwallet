import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "xwallet_session";

interface SessionPayload {
  sub: string;
  role: "ADMIN" | "CLIENT";
  status: "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";
}

function getSecret() {
  const secret =
    process.env.JWT_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "xwallet-asia-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

async function readSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSession(request);
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (pathname.startsWith("/dashboard")) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (session.role !== "CLIENT") return NextResponse.redirect(new URL("/admin", request.url));
    if (session.status === "PENDING_APPROVAL") {
      return NextResponse.redirect(new URL("/pending", request.url));
    }
    if (session.status === "SUSPENDED") return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin")) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (session.role !== "ADMIN") return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/pending") {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (session.status === "ACTIVE") {
      return NextResponse.redirect(
        new URL(session.role === "ADMIN" ? "/admin" : "/dashboard", request.url)
      );
    }
  }

  if (isAuthPage && session && session.status === "ACTIVE") {
    return NextResponse.redirect(
      new URL(session.role === "ADMIN" ? "/admin" : "/dashboard", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/pending", "/login", "/register"],
};
