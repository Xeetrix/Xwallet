"use client";

import { useActionState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { verifyTotpCode, type AuthActionState } from "@/actions/auth-actions";

const initialState: AuthActionState = { error: null };

export default function TotpVerifyForm({ qrValue }: { qrValue?: string }) {
  const [state, formAction, pending] = useActionState(verifyTotpCode, initialState);

  return (
    <div>
      {qrValue && (
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={qrValue} size={176} />
          </div>
          <p className="text-xs text-zinc-500 text-center leading-relaxed">
            Scan this with Google Authenticator, Authy, or any TOTP app, then enter the 6-digit code
            below to finish setup.
          </p>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
            Verification Code
          </label>
          <input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            className="luxury-input text-center tracking-[0.5em] text-lg"
            placeholder="000000"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 transition disabled:opacity-60"
        >
          {pending ? "Verifying..." : "Verify & Continue"}
        </button>
      </form>
    </div>
  );
}
