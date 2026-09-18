"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, X, Plus } from "lucide-react";
import type { Asset, NetworkAddress } from "@prisma/client";
import { submitDeposit, type DepositActionState } from "@/actions/client-actions";
import CryptoIcon from "@/components/CryptoIcon";

type AssetWithAddresses = Asset & { networkAddresses: NetworkAddress[] };

const initialState: DepositActionState = { error: null, success: false };

export default function DepositModal({ assets }: { assets: AssetWithAddresses[] }) {
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [networkName, setNetworkName] = useState(assets[0]?.networkAddresses[0]?.networkName ?? "");
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState(submitDeposit, initialState);

  const selectedAsset = useMemo(() => assets.find((a) => a.id === assetId), [assets, assetId]);
  const availableNetworks = selectedAsset?.networkAddresses ?? [];
  const selectedNetwork =
    availableNetworks.find((n) => n.networkName === networkName) ?? availableNetworks[0];

  useEffect(() => {
    if (availableNetworks.length > 0 && !availableNetworks.some((n) => n.networkName === networkName)) {
      setNetworkName(availableNetworks[0].networkName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => setOpen(false), 1800);
      return () => clearTimeout(timeout);
    }
  }, [state.success]);

  function handleCopy() {
    if (!selectedNetwork) return;
    navigator.clipboard.writeText(selectedNetwork.walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-gold hover:bg-gold-light text-obsidian text-sm font-medium px-4 py-2.5 transition"
      >
        <Plus className="w-4 h-4" />
        New Deposit
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

        <h3 className="font-serif text-lg text-zinc-100 mb-1">Fund Your Account</h3>
        <p className="text-sm text-zinc-500 mb-5">
          Send assets to the address below, then submit proof.
        </p>

        {state.success ? (
          <div className="text-center py-8">
            <Check className="w-10 h-10 text-emerald mx-auto mb-3" />
            <p className="text-emerald text-sm">Deposit submitted. Pending review by our custody desk.</p>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                  Asset
                </label>
                <div className="flex items-center gap-2">
                  <CryptoIcon symbol={selectedAsset?.symbol ?? "?"} size={32} />
                  <select
                    name="assetId"
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
                  Network
                </label>
                <select
                  name="networkName"
                  value={networkName}
                  onChange={(e) => setNetworkName(e.target.value)}
                  className="luxury-input"
                >
                  {availableNetworks.map((n) => (
                    <option key={n.id} value={n.networkName}>
                      {n.networkName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedNetwork ? (
              <div className="rounded-xl border border-zinc-800/60 p-4 flex flex-col items-center text-center bg-black/30">
                <div className="bg-white p-2.5 rounded-lg mb-3">
                  <QRCodeSVG value={selectedNetwork.walletAddress} size={140} />
                </div>
                <p className="text-xs text-zinc-500 mb-1.5">
                  Receiving Address ({selectedNetwork.networkName})
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-gold hover:text-gold-light font-mono break-all px-2 transition"
                >
                  {selectedNetwork.walletAddress}
                  {copied ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                  )}
                </button>
              </div>
            ) : (
              <p className="text-sm text-red-400">No receiving address configured for this asset yet.</p>
            )}

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
                Amount Sent
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
                Transaction Hash
              </label>
              <input
                name="txHash"
                type="text"
                required
                className="luxury-input font-mono"
                placeholder="0x..."
              />
            </div>

            {state.error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || !selectedNetwork}
              className="w-full rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 transition disabled:opacity-50"
            >
              {pending ? "Submitting..." : "Submit Deposit"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
