"use client";

import { useState, useEffect, useActionState } from "react";
import { Wallet, X, Check } from "lucide-react";
import type { User, Asset } from "@prisma/client";
import { manualBalanceAdjustment, type ActionResult } from "@/actions/admin-actions";

const initialState: ActionResult = { error: null, success: false };

export default function ManualAdjustModal({
  clients,
  assets,
}: {
  clients: User[];
  assets: Asset[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(manualBalanceAdjustment, initialState);

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
      <div className="w-full max-w-md luxury-card p-6 relative shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto">
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
              <select
                name="userId"
                required
                className="w-full rounded-lg bg-obsidian border border-line px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold/60"
              >
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
                <select
                  name="assetId"
                  required
                  className="w-full rounded-lg bg-obsidian border border-line px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold/60"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                  Type
                </label>
                <select
                  name="type"
                  required
                  className="w-full rounded-lg bg-obsidian border border-line px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold/60"
                >
                  <option value="CREDIT">Credit</option>
                  <option value="DEBIT">Debit</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                Amount
              </label>
              <input
                name="amount"
                type="number"
                step="any"
                min="0"
                required
                className="w-full rounded-lg bg-obsidian border border-line px-3.5 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold/60"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                Reference Note <span className="text-gold">(mandatory)</span>
              </label>
              <textarea
                name="note"
                required
                rows={2}
                className="w-full rounded-lg bg-obsidian border border-line px-3.5 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold/60 resize-none"
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
