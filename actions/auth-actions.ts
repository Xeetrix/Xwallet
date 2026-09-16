"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionCookie, destroySessionCookie, hashPassword, verifyPassword } from "@/lib/auth";

export interface AuthActionState {
  error: string | null;
}

export async function registerUser(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName || !email || !password) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  // If an ADMIN_BOOTSTRAP_EMAIL is configured, the master admin is
  // provisioned by lib/bootstrap.ts and registrations always go through
  // normal approval. Otherwise, fall back to promoting the very first
  // registrant so the platform is never permanently adminless — but only
  // one of these two paths is ever active, so there's no race between them.
  const bootstrapConfigured = Boolean(process.env.ADMIN_BOOTSTRAP_EMAIL);
  const userCount = bootstrapConfigured ? 1 : await prisma.user.count();
  const isFirstUser = !bootstrapConfigured && userCount === 0;

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      role: isFirstUser ? "ADMIN" : "CLIENT",
      status: isFirstUser ? "ACTIVE" : "PENDING_APPROVAL",
    },
  });

  await createSessionCookie({
    sub: user.id,
    role: user.role,
    status: user.status,
    fullName: user.fullName,
    email: user.email,
  });

  redirect(isFirstUser ? "/admin" : "/pending");
}

export async function loginUser(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  if (user.status === "SUSPENDED") {
    return { error: "This account has been suspended. Please contact your relationship manager." };
  }

  await createSessionCookie({
    sub: user.id,
    role: user.role,
    status: user.status,
    fullName: user.fullName,
    email: user.email,
  });

  if (user.role === "ADMIN") redirect("/admin");
  if (user.status === "PENDING_APPROVAL") redirect("/pending");
  redirect("/dashboard");
}

export async function logoutUser(): Promise<void> {
  await destroySessionCookie();
  redirect("/login");
}
