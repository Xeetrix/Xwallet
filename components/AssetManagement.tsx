"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X } from "lucide-react";
import type { Asset, NetworkAddress } from "@prisma/client";
import { cn } from "@/lib/utils";
import CryptoIcon from "@/components/CryptoIcon";
import {
  createAsset,
  configureAssetAddress,
  toggleAssetActive,
  toggleNetworkAddressActive,
  type ActionResult,
} from "@/actions/admin-actions";

type AssetWithAddresses = Asset & { networkAddresses: NetworkAddress[] };

const initialState: ActionResult = { error: null, success: false };

export default function AssetManagement({ assets }: { assets: AssetWithAddresses[] }) {
  return (
    <div className="space-y-8">
      <CreateAssetPanel />
      <div className="space-y-6">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
        {assets.length === 0 && (
          <p className="text-sm text-zinc-500">No assets configured yet.</p>
        )}
      </div>
    </div>
  );
}

function CreateAssetPanel() {
  const [state, formAction, pending] = useActionState(createAsset, initialState);
  const [symbolPreview, setSymbolPreview] = useState("");

  return (
    <div className="luxury-card p-6">
      <h2 className="font-serif text-lg text-zinc-100 mb-4">Add New Asset</h2>
      <p className="text-xs text-zinc-500 mb-4">
        The badge icon is resolved automatically from the ticker symbol — no logo upload needed.
      </p>
      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-3 items-end">
        <div className="hidden sm:flex flex-col items-center justify-center">
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5 opacity-0">
            Icon
          </label>
          <CryptoIcon symbol={symbolPreview || "?"} size={40} />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Symbol</label>
          <input
            name="symbol"
            required
            placeholder="USDT"
            value={symbolPreview}
            onChange={(e) => setSymbolPreview(e.target.value)}
            className="luxury-input uppercase"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Name</label>
          <input name="name" required placeholder="Tether USD" className="luxury-input" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 px-4 transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Asset
        </button>
      </form>
      {state.error && <p className="mt-3 text-sm text-red-400">{state.error}</p>}
      {state.success && <p className="mt-3 text-sm text-emerald">Asset created.</p>}
    </div>
  );
}

function AssetCard({ asset }: { asset: AssetWithAddresses }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleActive() {
    startTransition(async () => {
      await toggleAssetActive(asset.id, !asset.isActive);
      router.refresh();
    });
  }

  return (
    <div className="luxury-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CryptoIcon symbol={asset.symbol} size={36} />
          <div>
            <p className="text-sm text-zinc-100">{asset.name}</p>
            <p className="text-xs text-zinc-500">{asset.symbol}</p>
          </div>
        </div>
        <button
          disabled={isPending}
          onClick={toggleActive}
          className={cn(
            "text-xs rounded-full px-3 py-1.5 border transition disabled:opacity-50",
            asset.isActive
              ? "bg-emerald/10 text-emerald border-emerald/30 hover:bg-emerald/20"
              : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/20"
          )}
        >
          {asset.isActive ? "Active" : "Inactive"}
        </button>
      </div>

      <div className="space-y-2 mb-4">
        {asset.networkAddresses.map((addr) => (
          <div
            key={addr.id}
            className="flex items-center justify-between rounded-lg border border-zinc-800/60 px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-xs text-zinc-500 mb-0.5">{addr.networkName}</p>
              <p className="text-xs text-zinc-300 font-mono truncate max-w-xs">{addr.walletAddress}</p>
            </div>
            <NetworkAddressToggleButton id={addr.id} isActive={addr.isActive} />
          </div>
        ))}
        {asset.networkAddresses.length === 0 && (
          <p className="text-sm text-zinc-500">No receiving addresses configured.</p>
        )}
      </div>

      <AddressForm assetId={asset.id} />
    </div>
  );
}

function NetworkAddressToggleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleNetworkAddressActive(id, !isActive);
          router.refresh();
        })
      }
      className={cn(
        "text-xs rounded-full px-2.5 py-1 border shrink-0 transition disabled:opacity-50",
        isActive
          ? "bg-emerald/10 text-emerald border-emerald/30"
          : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
      )}
    >
      {isActive ? "Active" : "Disabled"}
    </button>
  );
}

function AddressForm({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(configureAssetAddress, initialState);

  // Without this, a successful save gave zero visible feedback — the form
  // just silently reset to empty fields, which reads identically to "it
  // didn't work." Show a confirmation, then close, matching every other
  // modal in the admin (ManualAdjustModal, DepositModal).
  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => setOpen(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [state.success]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gold hover:text-gold-light transition">
        + Add / update receiving address
      </button>
    );
  }

  if (state.success) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald mt-2">
        <Check className="w-4 h-4" />
        Receiving address saved.
      </div>
    );
  }

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end mt-2">
      <input type="hidden" name="assetId" value={assetId} />
      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Network</label>
        <input name="networkName" required placeholder="TRC20" className="luxury-input" />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
          Wallet Address
        </label>
        <input
          name="walletAddress"
          required
          placeholder="T9yD14..."
          className="luxury-input font-mono"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold hover:bg-gold-light text-obsidian text-sm font-medium py-2 transition disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {pending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-800/60 px-3 text-zinc-400 hover:text-zinc-200 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {state.error && <p className="sm:col-span-3 text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
