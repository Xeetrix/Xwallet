"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import { prisma } from "@/lib/prisma";
import { requireFreshClientSession } from "@/lib/auth";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";

export interface SecurityActionState {
  error: string | null;
  success: boolean;
}

function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex"));
}

export interface BeginEnrollmentResult {
  error: string | null;
  qrValue: string | null;
  backupCodes: string[] | null;
}

/**
 * Step 1 of client self-service 2FA enrollment: generates a fresh secret
 * and a set of backup codes, stores the secret encrypted and the codes
 * hashed, and returns everything plaintext exactly once for display —
 * nothing is enabled yet, confirmTotpEnrollment() must succeed first.
 */
export async function beginTotpEnrollment(): Promise<BeginEnrollmentResult> {
  const session = await requireFreshClientSession();
  if (session.totpEnabled) {
    return { error: "Two-factor authentication is already enabled.", qrValue: null, backupCodes: null };
  }

  const plainSecret = generateSecret();
  const backupCodes = generateBackupCodes();
  const hashes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

  await prisma.user.update({
    where: { id: session.sub },
    data: { totpSecretEncrypted: encryptSecret(plainSecret), totpBackupCodesHash: hashes },
  });

  const qrValue = generateURI({ issuer: "XWallet Asia", label: session.email, secret: plainSecret });
  return { error: null, qrValue, backupCodes: backupCodes.map((c) => `${c.slice(0, 5)}-${c.slice(5)}`) };
}

export async function confirmTotpEnrollment(
  _prevState: SecurityActionState,
  formData: FormData
): Promise<SecurityActionState> {
  const session = await requireFreshClientSession();
  const code = String(formData.get("code") ?? "").trim();

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { totpSecretEncrypted: true, totpEnabled: true },
  });
  if (!user?.totpSecretEncrypted) {
    return { error: "Start enrollment again before confirming.", success: false };
  }
  if (user.totpEnabled) {
    return { error: "Two-factor authentication is already enabled.", success: false };
  }
  if (!/^\d{6}$/.test(code)) {
    return { error: "Enter the 6-digit code from your authenticator app.", success: false };
  }

  const secret = decryptSecret(user.totpSecretEncrypted);
  const result = await verifyTotp({ secret, token: code, epochTolerance: 30 });
  if (!result.valid) {
    return { error: "Invalid code. Please try again.", success: false };
  }

  await prisma.user.update({ where: { id: session.sub }, data: { totpEnabled: true } });
  await writeAuditLog({ actorId: session.sub, action: "CLIENT_2FA_ENABLED", targetType: "User", targetId: session.sub });

  revalidatePath("/dashboard/security");
  return { error: null, success: true };
}

export async function disableTotp(): Promise<SecurityActionState> {
  const session = await requireFreshClientSession();

  await prisma.user.update({
    where: { id: session.sub },
    data: { totpEnabled: false, totpSecretEncrypted: null, totpBackupCodesHash: [] },
  });
  await writeAuditLog({ actorId: session.sub, action: "CLIENT_2FA_DISABLED", targetType: "User", targetId: session.sub });

  revalidatePath("/dashboard/security");
  return { error: null, success: true };
}
