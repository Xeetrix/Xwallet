"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import { Repeat, Check, X, ArrowDown } from "lucide-react";
import type { Asset, UserBalance } from "@prisma/client";
import { convertAsset, getSwapQuote, type SwapActionState, type SwapQuote } from "@/actions/client-actions";
import CryptoIcon from "@/components/CryptoIcon";

// balance is a plain number here, not Prisma's Decimal — the server
// component serializes it before passing this data down as a prop.
type BalanceWithAsset = Omit<UserBalance, "balance"> & { balance: number; asset: Asset };

const initialState: SwapActionState = { error: null, success: false };

export default function ConvertModal({
  balances,
  assets,
}: {
  balances: BalanceWithAsset[];
  assets: Asset[];
}) {
  const [open, setOpen] = useState(false);
  const [fromAssetId, setFromAssetId] = useState(balances[0]?.assetId ?? "");
  const [toAssetId, setToAssetId] = useState(assets.find((a) => a.id !== balances[0]?.assetId)?.id ?? "");
  const [amountRaw, setAmountRaw] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [state, formAction, pending] = useActionState(convertAsset, initialState);

  const fromBalance = useMemo(() => balances.find((b) => b.assetId === fromAssetId), [balances, fromAssetId]);
  const fromAsset = fromBalance?.asset;
  const toAsset = useMemo(() => assets.find((a) => a.id === toAssetId), [assets, toAssetId]);
  const amount = Number(amountRaw);
  const availableBalance = fromBalance ? Number(fromBalance.balance) : 0;
  const insufficientLocally = amount > 0 && amount > availableBalance;

  useEffect(() => {
    if (toAssetId === fromAssetId) {
      const next = assets.find((a) => a.id !== fromAssetId);
      if (next) setToAssetId(next.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAssetId]);

  useEffect(() => {
    if (!fromAsset || !toAsset || !Number.isFinite(amount) || amount <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    const timeout = setTimeout(() => {
      getSwapQuote(fromAsset.symbol, toAsset.symbol, amount).then((result) => {
        if (cancelled) return;
        setQuoteLoading(false);
        if ("error" in result) {
          setQuote(null);
          setQuoteError(result.error);
        } else {
          setQuote(result);
          setQuoteError(null);
        }
      });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [fromAsset, toAsset, amount]);

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => {
        setOpen(false);
        setAmountRaw("");
        setQuote(null);
      }, 1800);
      return () => clearTimeout(timeout);
    }
  }, [state.success]);

  if (balances.length === 0 || assets.length < 2) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 hover:border-gold/40 text-zinc-100 text-sm font-medium px-4 py-2.5 transition"
      >
        <Repeat className="w-4 h-4 text-gold" />
        Convert
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

        <h3 className="font-serif text-lg text-zinc-100 mb-1">Convert Assets</h3>
        <p className="text-sm text-zinc-500 mb-5">Swap between holdings at live market rates.</p>

        {state.success ? (
          <div className="text-center py-8">
            <Check className="w-10 h-10 text-emerald mx-auto mb-3" />
            <p className="text-emerald text-sm">Conversion complete.</p>
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            <div className="rounded-xl border border-zinc-800/60 bg-black/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-zinc-500">You Pay</span>
                <span className="text-[11px] text-zinc-600">
                  Balance:{" "}
                  <span className="font-mono tabular-nums">
                    {availableBalance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CryptoIcon symbol={fromAsset?.symbol ?? "?"} size={28} />
                <select
                  name="fromAssetId"
                  required
                  value={fromAssetId}
                  onChange={(e) => setFromAssetId(e.target.value)}
                  className="luxury-input"
                >
                  {balances.map((b) => (
                    <option key={b.assetId} value={b.assetId}>
                      {b.asset.symbol}
                    </option>
                  ))}
                </select>
                <input
                  name="amount"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(e.target.value)}
                  className="luxury-input font-mono tabular-nums text-right"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <div className="rounded-full border border-zinc-800/60 bg-zinc-900 p-1.5">
                <ArrowDown className="w-3.5 h-3.5 text-gold" />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/60 bg-black/30 p-4">
              <span className="text-xs uppercase tracking-wider text-zinc-500 mb-2 block">
                You Receive (Guaranteed)
              </span>
              <div className="flex items-center gap-2">
                <CryptoIcon symbol={toAsset?.symbol ?? "?"} size={28} />
                <select
                  name="toAssetId"
                  required
                  value={toAssetId}
                  onChange={(e) => setToAssetId(e.target.value)}
                  className="luxury-input"
                >
                  {assets
                    .filter((a) => a.id !== fromAssetId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.symbol}
                      </option>
                    ))}
                </select>
                <div className="luxury-input font-mono tabular-nums text-right flex items-center justify-end">
                  {quoteLoading ? "…" : quote ? quote.netReceive.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "0.00"}
                </div>
              </div>
            </div>

            {quote && fromAsset && toAsset && (
              <div className="rounded-lg border border-zinc-800/60 bg-black/30 p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-500">
                  <span>Estimated rate</span>
                  <span className="font-mono tabular-nums text-zinc-300">
                    1 {fromAsset.symbol} ≈ {quote.rate.toLocaleString(undefined, { maximumFractionDigits: 8 })}{" "}
                    {toAsset.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Platform swap fee ({(quote.feeRate * 100).toFixed(2)}%)</span>
                  <span className="font-mono tabular-nums text-zinc-300">
                    {quote.feeAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })} {toAsset.symbol}
                  </span>
                </div>
                <div className="flex justify-between font-medium pt-1.5 border-t border-zinc-800/60">
                  <span className="text-zinc-400">Guaranteed amount</span>
                  <span className="font-mono tabular-nums text-gold">
                    {quote.netReceive.toLocaleString(undefined, { maximumFractionDigits: 8 })} {toAsset.symbol}
                  </span>
                </div>
              </div>
            )}

            {quoteError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {quoteError}
              </p>
            )}

            {insufficientLocally && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                Insufficient balance for this amount.
              </p>
            )}

            {state.error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || insufficientLocally || !quote || quoteLoading}
              className="w-full rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 transition disabled:opacity-50"
            >
              {pending ? "Converting..." : "Confirm Conversion"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
