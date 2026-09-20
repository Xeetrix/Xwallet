"use client";

import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  type SecurityActionState,
} from "@/actions/security-actions";

const initialConfirmState: SecurityActionState = { error: null, success: false };

export default function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const [enrolling, setEnrolling] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [beginError, setBeginError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [confirmState, confirmAction, confirmPending] = useActionState(
    async (_prev: SecurityActionState, formData: FormData) => {
      const result = await confirmTotpEnrollment(_prev, formData);
      if (result.success) {
        setEnrolling(false);
        setQrValue(null);
        setBackupCodes(null);
        router.refresh();
      }
      return result;
    },
    initialConfirmState
  );

  function startEnrollment() {
    setBeginError(null);
    startTransition(async () => {
      const result = await beginTotpEnrollment();
      if (result.error) {
        setBeginError(result.error);
        return;
      }
      setQrValue(result.qrValue);
      setBackupCodes(result.backupCodes);
      setEnrolling(true);
    });
  }

  function handleDisable() {
    if (!confirm("Disable two-factor authentication on this account?")) return;
    startTransition(async () => {
      await disableTotp();
      router.refresh();
    });
  }

  if (enabled) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald" />
          <div>
            <p className="text-sm text-zinc-100">Two-factor authentication is active</p>
            <p className="text-xs text-zinc-500">
              You&apos;ll be asked for a code when sending transfers or requesting withdrawals.
            </p>
          </div>
        </div>
        <button
          onClick={handleDisable}
          disabled={isPending}
          className="shrink-0 flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition disabled:opacity-50"
        >
          <ShieldOff className="w-3.5 h-3.5" />
          Disable
        </button>
      </div>
    );
  }

  if (!enrolling) {
    return (
      <div>
        <p className="text-sm text-zinc-500 mb-4">
          Add an authenticator-app code as a second step when sending transfers or requesting
          withdrawals.
        </p>
        <button
          onClick={startEnrollment}
          disabled={isPending}
          className="rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm px-4 py-2 transition disabled:opacity-60"
        >
          {isPending ? "Preparing..." : "Enable Two-Factor Authentication"}
        </button>
        {beginError && <p className="text-xs text-red-400 mt-2">{beginError}</p>}
      </div>
    );
  }

  return (
    <div>
      {qrValue && (
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={qrValue} size={176} />
          </div>
          <p className="text-xs text-zinc-500 text-center">
            Scan with Google Authenticator, Authy, or any TOTP app.
          </p>
        </div>
      )}

      {backupCodes && (
        <div className="mb-6 rounded-xl border border-gold/30 bg-gold/5 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <KeyRound className="w-4 h-4 text-gold" />
            <p className="text-xs uppercase tracking-wider text-gold">Backup Recovery Codes</p>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Save these somewhere safe. Each code can be used once if you lose access to your
            authenticator app — they will not be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm text-zinc-100">
            {backupCodes.map((code) => (
              <span key={code} className="bg-black/30 rounded px-2 py-1 text-center">
                {code}
              </span>
            ))}
          </div>
        </div>
      )}

      <form action={confirmAction} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
            Enter Code To Confirm
          </label>
          <input
            name="code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            className="luxury-input text-center tracking-[0.5em] text-lg"
            placeholder="000000"
          />
        </div>
        {confirmState?.error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {confirmState.error}
          </p>
        )}
        <button
          type="submit"
          disabled={confirmPending}
          className="w-full rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 transition disabled:opacity-60"
        >
          {confirmPending ? "Confirming..." : "Confirm & Enable"}
        </button>
      </form>
    </div>
  );
}
