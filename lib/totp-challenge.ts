import bcrypt from "bcryptjs";
import { verify as verifyTotp } from "otplib";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

/**
 * For a client who has opted into TOTP, verifies the code submitted
 * alongside a sensitive fund-movement action — either a live 6-digit TOTP
 * code, or one of their single-use backup codes (consumed immediately on
 * match so it can't be replayed). No-ops for a client who hasn't enabled
 * 2FA — enrollment is optional, this only enforces it once chosen.
 */
export async function verifyTotpOrBackupCode(params: {
  userId: string;
  totpEnabled: boolean;
  code: string | null;
}): Promise<{ error: string | null }> {
  if (!params.totpEnabled) return { error: null };

  const code = params.code?.trim();
  if (!code) {
    return { error: "Enter your 2FA code to confirm this transaction." };
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { totpSecretEncrypted: true, totpBackupCodesHash: true },
  });
  if (!user?.totpSecretEncrypted) {
    return { error: "Two-factor authentication is not properly configured on this account." };
  }

  if (/^\d{6}$/.test(code)) {
    const secret = decryptSecret(user.totpSecretEncrypted);
    const result = await verifyTotp({ secret, token: code, epochTolerance: 30 });
    if (result.valid) return { error: null };
  }

  // Fall back to backup codes — clients may paste them with or without the
  // display dash, so compare on a normalized form. Each match is consumed
  // immediately so it can never be reused.
  const normalized = code.replace(/-/g, "").toLowerCase();
  for (const hash of user.totpBackupCodesHash) {
    if (await bcrypt.compare(normalized, hash)) {
      await prisma.user.update({
        where: { id: params.userId },
        data: { totpBackupCodesHash: user.totpBackupCodesHash.filter((h) => h !== hash) },
      });
      return { error: null };
    }
  }

  return { error: "Invalid 2FA code." };
}
