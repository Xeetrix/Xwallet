"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import { ArrowUpFromLine, Check, X } from "lucide-react";
import type { Asset, UserBalance } from "@prisma/client";
import {
  requestWithdrawal,
  getNetworkFeeQuote,
  type WithdrawActionState,
  type NetworkFeeQuoteResult,
} from "@/actions/client-actions";
import CryptoIcon from "@/components/CryptoIcon";

// balance is a plain number here, not Prisma's Decimal — the server
// component serializes it before passing this data down as a prop.
type BalanceWithAsset = Omit<UserBalance, "balance"> & {
  balance: number;
  asset: Asset;
};

const initialState: WithdrawActionState = { error: null, success: false };

export default function WithdrawModal({
  balances,
  totpEnabled = false,
}: {
  balances: BalanceWithAsset[];
  totpEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState(balances[0]?.assetId ?? "");
  const [networkName, setNetworkName] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [feeQuote, setFeeQuote] = useState<NetworkFeeQuoteResult | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [state, formAction, pending] = useActionState(requestWithdrawal, initialState);

  const selectedBalance = useMemo(() => balances.find((b) => b.assetId === assetId), [balances, assetId]);
  const amount = Number(amountRaw);
  const availableBalance = selectedBalance ? Number(selectedBalance.balance) : 0;
  const insufficientAmount = amount > 0 && amount > availableBalance;

  const gasBalance = useMemo(
    () => (feeQuote ? balances.find((b) => b.asset.symbol === feeQuote.gasAssetSymbol) : undefined),
    [balances, feeQuote]
  );
  const gasBalanceAmount = gasBalance ? Number(gasBalance.balance) : 0;
  const insufficientGas = feeQuote !== null && feeQuote.feeInGasAsset > gasBalanceAmount;

  useEffect(() => {
    if (!selectedBalance || !networkName || !Number.isFinite(amount) || amount <= 0) {
      setFeeQuote(null);
      setFeeError(null);
      return;
    }

    let cancelled = false;
    setFeeLoading(true);
    const timeout = setTimeout(() => {
      getNetworkFeeQuote(selectedBalance.asset.symbol, networkName, amount, "WITHDRAWAL").then((result) => {
        if (cancelled) return;
        setFeeLoading(false);
        if ("error" in result) {
          setFeeQuote(null);
          setFeeError(result.error);
        } else {
          setFeeQuote(result);
          setFeeError(null);
        }
      });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [selectedBalance, networkName, amount]);

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => {
        setOpen(false);
        setAmountRaw("");
        setNetworkName("");
      }, 1800);
      return () => clearTimeout(timeout);
    }
  }, [state.success]);

  if (balances.length === 0) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 hover:border-gold/40 text-zinc-100 text-sm font-medium px-4 py-2.5 transition"
      >
        <ArrowUpFromLine className="w-4 h-4 text-gold" />
        Withdraw
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md luxury-card p-6 relative max-h-[90vh] overflow-y-auto animate-scale-in">
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="font-serif text-lg text-zinc-100 mb-1">Withdraw to External Wallet</h3>
        <p className="text-sm text-zinc-500 mb-5">
          Funds are reserved immediately. The network fee is paid separately, in that chain&apos;s native
          asset. Our custody desk sends the transfer and marks it complete.
        </p>

        {state.success ? (
          <div className="text-center py-8">
            <Check className="w-10 h-10 text-emerald mx-auto mb-3" />
            <p className="text-emerald text-sm">Withdrawal requested. Pending review by our custody desk.</p>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                  Asset
                </label>
                <div className="flex items-center gap-2">
                  <CryptoIcon symbol={selectedBalance?.asset.symbol ?? "?"} size={32} />
                  <select
                    name="assetId"
                    required
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="luxury-input"
                  >
                    {balances.map((b) => (
                      <option key={b.assetId} value={b.assetId}>
                        {b.asset.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                  Network
                </label>
                <input
                  name="networkName"
                  required
                  value={networkName}
                  onChange={(e) => setNetworkName(e.target.value)}
                  placeholder="TRC20"
                  className="luxury-input uppercase"
                />
              </div>
            </div>

            {selectedBalance && (
              <p className="text-xs text-zinc-500">
                Available balance:{" "}
                <span className="font-mono tabular-nums text-zinc-300">
                  {availableBalance.toLocaleString(undefined, { maximumFractionDigits: 8 })}{" "}
                  {selectedBalance.asset.symbol}
                </span>
              </p>
            )}

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                Destination Wallet Address
              </label>
              <input
                name="destinationAddress"
                required
                className="luxury-input font-mono"
                placeholder="T9yD14..."
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Amount</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">
                  {selectedBalance?.asset.symbol ?? ""}
                </span>
                <input
                  name="amount"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(e.target.value)}
                  className="luxury-input !pl-14 font-mono tabular-nums"
                  placeholder="0.00"
                />
              </div>
            </div>

            {feeQuote && (
              <div className="rounded-lg border border-zinc-800/60 bg-black/30 p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-500">
                  <span>Network fee ({(feeQuote.feeRate * 100).toFixed(2)}%, paid in {feeQuote.gasAssetSymbol})</span>
                  <span
                    className={`font-mono tabular-nums ${insufficientGas ? "text-red-400" : "text-zinc-300"}`}
                  >
                    {feeQuote.feeInGasAsset.toLocaleString(undefined, { maximumFractionDigits: 8 })}{" "}
                    {feeQuote.gasAssetSymbol}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Your {feeQuote.gasAssetSymbol} balance</span>
                  <span className="font-mono tabular-nums">
                    {gasBalanceAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  </span>
                </div>
              </div>
            )}

            {feeLoading && <p className="text-xs text-zinc-600">Calculating network fee…</p>}

            {feeError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {feeError}
              </p>
            )}

            {totpEnabled && (
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                  2FA Code
                </label>
                <input
                  name="totpCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  className="luxury-input text-center tracking-[0.3em] font-mono"
                  placeholder="000000"
                />
                <p className="text-[11px] text-zinc-600 mt-1">
                  Enter your authenticator code, or a backup code.
                </p>
              </div>
            )}

            {insufficientAmount && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                Insufficient {selectedBalance?.asset.symbol} balance for this amount.
              </p>
            )}

            {insufficientGas && !insufficientAmount && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                You need {feeQuote?.gasAssetSymbol} to pay the network fee — insufficient {feeQuote?.gasAssetSymbol}{" "}
                balance.
              </p>
            )}

            {state.error && !insufficientAmount && !insufficientGas && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || insufficientAmount || insufficientGas || feeLoading || !feeQuote}
              className="w-full rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 transition disabled:opacity-50"
            >
              {pending ? "Submitting..." : "Request Withdrawal"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
