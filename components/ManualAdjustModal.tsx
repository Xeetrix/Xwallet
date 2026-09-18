"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import { Wallet, X, Check } from "lucide-react";
import type { User, Asset } from "@prisma/client";
import { manualBalanceAdjustment, type ActionResult } from "@/actions/admin-actions";
import CryptoIcon from "@/components/CryptoIcon";

const initialState: ActionResult = { error: null, success: false };

export default function ManualAdjustModal({
  clients,
  assets,
}: {
  clients: User[];
  assets: Asset[];
}) {
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [type, setType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [state, formAction, pending] = useActionState(manualBalanceAdjustment, initialState);

  const selectedAsset = useMemo(() => assets.find((a) => a.id === assetId), [assets, assetId]);

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => setOpen(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [state.success]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-gold hover:bg-gold-light text-obsidian text-sm font-medium px-4 py-2.5 transition"
      >
        <Wallet className="w-4 h-4" />
        Manual Adjustment
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md luxury-card p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="font-serif text-lg text-zinc-100 mb-1">Manual Balance Adjustment</h3>
        <p className="text-sm text-zinc-500 mb-5">
          Credit or debit a client for bank wire, cash, or corrective entries.
        </p>

        {state.success ? (
          <div className="text-center py-8">
            <Check className="w-10 h-10 text-emerald mx-auto mb-3" />
            <p className="text-emerald text-sm">Balance adjusted and ledger entry recorded.</p>
          </div>
        ) : clients.length === 0 ? (
          <p className="text-sm text-zinc-500">No active clients yet.</p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                Client
              </label>
              <select name="userId" required className="luxury-input">
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                  Asset
                </label>
                <div className="flex items-center gap-2">
                  <CryptoIcon symbol={selectedAsset?.symbol ?? "?"} size={32} />
                  <select
                    name="assetId"
                    required
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="luxury-input"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-zinc-800/60 bg-black/30 p-1">
                  <input type="hidden" name="type" value={type} />
                  <button
                    type="button"
                    onClick={() => setType("CREDIT")}
                    className={`rounded-md py-1.5 text-xs font-medium transition ${
                      type === "CREDIT" ? "bg-emerald/15 text-emerald" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Credit
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("DEBIT")}
                    className={`rounded-md py-1.5 text-xs font-medium transition ${
                      type === "DEBIT" ? "bg-red-500/15 text-red-400" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Debit
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                Amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">
                  {selectedAsset?.symbol ?? ""}
                </span>
                <input
                  name="amount"
                  type="number"
                  step="any"
                  min="0"
                  required
                  className="luxury-input !pl-14 font-mono tabular-nums"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                Reference Note <span className="text-gold">(mandatory)</span>
              </label>
              <textarea
                name="note"
                required
                rows={2}
                className="luxury-input resize-none"
                placeholder="e.g. Bank wire received — credited 10,000 USDT"
              />
            </div>

            {state.error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 transition disabled:opacity-50"
            >
              {pending ? "Processing..." : "Confirm Adjustment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
