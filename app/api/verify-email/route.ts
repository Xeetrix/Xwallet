import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const origin = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", origin));
  }

  const user = await prisma.user.findUnique({ where: { emailVerificationToken: token } });
  if (!user) {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", origin));
  }

  if (user.status === "ACTIVE") {
    return NextResponse.redirect(new URL("/verify-email?status=already-active", origin));
  }
  if (user.status !== "PENDING_APPROVAL") {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", origin));
  }
  if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
    return NextResponse.redirect(new URL("/verify-email?status=expired", origin));
  }

  // Conditional update guards against a double-click or link-retry racing
  // past a separate read-then-write check, same pattern used for the
  // balance-changing admin actions. The token is deliberately left in
  // place rather than cleared: re-visiting the same link once already
  // active just falls into the "already-active" branch above rather than
  // wrongly looking unused/invalid — it can never re-activate a since
  // -suspended account, since this update only fires from PENDING_APPROVAL.
  const updated = await prisma.user.updateMany({
    where: { id: user.id, status: "PENDING_APPROVAL" },
    data: { status: "ACTIVE" },
  });

  if (updated.count === 0) {
    return NextResponse.redirect(new URL("/verify-email?status=already-active", origin));
  }

  return NextResponse.redirect(new URL("/verify-email?status=success", origin));
}
