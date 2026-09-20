import { redirect } from "next/navigation";
import { generateURI } from "otplib";
import { readPendingTotpCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import TotpVerifyForm from "@/components/TotpVerifyForm";

export default async function Verify2FAPage() {
  const pending = await readPendingTotpCookie();
  if (!pending) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: pending.sub } });
  if (!user || user.role !== "ADMIN" || !user.totpSecretEncrypted) redirect("/login");

  const needsEnrollment = !user.totpEnabled;
  const qrValue = needsEnrollment
    ? generateURI({
        issuer: "XWallet Asia",
        label: user.email,
        secret: decryptSecret(user.totpSecretEncrypted),
      })
    : undefined;

  return (
    <div>
      <h2 className="font-serif text-xl text-zinc-100 mb-1">
        {needsEnrollment ? "Set Up Two-Factor Authentication" : "Two-Factor Verification"}
      </h2>
      <p className="text-sm text-zinc-500 mb-6">
        {needsEnrollment
          ? "Admin accounts require an authenticator app. Scan the code below to finish setup."
          : "Enter the 6-digit code from your authenticator app to continue."}
      </p>
      <TotpVerifyForm qrValue={qrValue} />
    </div>
  );
}
