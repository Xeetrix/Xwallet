"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { generateSecret, verify as verifyTotp } from "otplib";
import { prisma } from "@/lib/prisma";
import {
  createPendingTotpCookie,
  createSessionCookie,
  destroyPendingTotpCookie,
  destroySessionCookie,
  hashPassword,
  readPendingTotpCookie,
  verifyPassword,
} from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { sendVerificationEmail } from "@/lib/email";

const VERIFICATION_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Puts a freshly-authenticated ADMIN through the mandatory TOTP gate
 * instead of issuing a real session directly. Generates a secret on first
 * use — totpEnabled stays false until it's actually verified once, so a
 * secret existing alone never grants access.
 */
async function beginAdminTotpChallenge(user: { id: string; totpSecretEncrypted: string | null }): Promise<never> {
  if (!user.totpSecretEncrypted) {
    const plainSecret = generateSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecretEncrypted: encryptSecret(plainSecret) },
    });
  }
  await createPendingTotpCookie(user.id);
  redirect("/verify-2fa");
}

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

  // Self-service email confirmation lets a client activate their own
  // account without waiting on admin review — the admin "Approve" button
  // stays available too, as a fallback for anyone who can't confirm by
  // email. The first/bootstrap admin skips this entirely (already ACTIVE).
  const verificationToken = isFirstUser ? null : randomBytes(32).toString("hex");
  const verificationExpires = isFirstUser ? null : new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      role: isFirstUser ? "ADMIN" : "CLIENT",
      status: isFirstUser ? "ACTIVE" : "PENDING_APPROVAL",
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    },
  });

  if (verificationToken) {
    await sendVerificationEmail({ to: user.email, fullName: user.fullName, token: verificationToken });
  }

  // The bootstrap admin (first registrant, when no ADMIN_BOOTSTRAP_EMAIL is
  // configured) is still subject to mandatory TOTP — it goes through the
  // same challenge as any other ADMIN login rather than getting a free
  // pass on session issuance.
  if (isFirstUser) {
    await beginAdminTotpChallenge(user);
  }

  await createSessionCookie({
    sub: user.id,
    role: user.role,
    status: user.status,
    fullName: user.fullName,
    email: user.email,
  });

  redirect("/pending");
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

  // ADMIN accounts never get a session cookie straight from a password
  // check — TOTP is mandatory, so control passes to /verify-2fa instead.
  if (user.role === "ADMIN") {
    await beginAdminTotpChallenge(user);
  }

  await createSessionCookie({
    sub: user.id,
    role: user.role,
    status: user.status,
    fullName: user.fullName,
    email: user.email,
  });

  if (user.status === "PENDING_APPROVAL") redirect("/pending");
  redirect("/dashboard");
}

export async function logoutUser(): Promise<void> {
  await destroySessionCookie();
  await destroyPendingTotpCookie();
  redirect("/login");
}

export async function verifyTotpCode(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const code = String(formData.get("code") ?? "").trim();

  const pending = await readPendingTotpCookie();
  if (!pending) {
    return { error: "Your verification session has expired. Please sign in again." };
  }

  const user = await prisma.user.findUnique({ where: { id: pending.sub } });
  if (!user || user.role !== "ADMIN" || !user.totpSecretEncrypted) {
    await destroyPendingTotpCookie();
    return { error: "Something went wrong. Please sign in again." };
  }
  if (user.status === "SUSPENDED") {
    await destroyPendingTotpCookie();
    return { error: "This account has been suspended. Please contact your relationship manager." };
  }
  if (!code || !/^\d{6}$/.test(code)) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  const secret = decryptSecret(user.totpSecretEncrypted);
  // epochTolerance allows ±30s of clock drift between server and
  // authenticator app — otplib's default (0) is stricter than real-world
  // devices reliably manage.
  const result = await verifyTotp({ secret, token: code, epochTolerance: 30 });
  if (!result.valid) {
    return { error: "Invalid verification code. Please try again." };
  }

  if (!user.totpEnabled) {
    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  }

  await destroyPendingTotpCookie();
  await createSessionCookie({
    sub: user.id,
    role: user.role,
    status: user.status,
    fullName: user.fullName,
    email: user.email,
  });

  redirect("/admin");
}
