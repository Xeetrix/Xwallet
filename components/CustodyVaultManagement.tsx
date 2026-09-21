"use client";

import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Vault as VaultIcon } from "lucide-react";
import type { Asset, CustodyVault, VaultReserve } from "@prisma/client";
import { cn } from "@/lib/utils";
import CryptoIcon from "@/components/CryptoIcon";
import {
  createCustodyVault,
  toggleCustodyVaultActive,
  updateVaultReserve,
  type ActionResult,
} from "@/actions/admin-actions";

type VaultWithReserves = CustodyVault & { reserves: (VaultReserve & { asset: Asset })[] };

const initialState: ActionResult = { error: null, success: false };

export default function CustodyVaultManagement({
  vaults,
  assets,
}: {
  vaults: VaultWithReserves[];
  assets: Asset[];
}) {
  return (
    <div className="space-y-8">
      <CreateVaultPanel />
      <div className="space-y-6">
        {vaults.map((vault) => (
          <VaultCard key={vault.id} vault={vault} assets={assets} />
        ))}
        {vaults.length === 0 && (
          <p className="text-sm text-zinc-500">
            No custody vaults configured. Withdrawals cannot be approved until at least one active vault exists.
          </p>
        )}
      </div>
    </div>
  );
}

function CreateVaultPanel() {
  const [state, formAction, pending] = useActionState(createCustodyVault, initialState);

  return (
    <div className="luxury-card p-6">
      <h2 className="font-serif text-lg text-zinc-100 mb-4 flex items-center gap-2">
        <VaultIcon className="w-4 h-4 text-gold" />
        Add Custody Vault
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        Register a Gnosis Safe or MPC (e.g. Fireblocks) vault. Withdrawals are queued against the first
        active vault for institutional multi-signer approval.
      </p>
      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Name</label>
          <input name="name" required placeholder="Primary Treasury Safe" className="luxury-input" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Provider</label>
          <input name="provider" required placeholder="GNOSIS_SAFE" className="luxury-input" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Chain ID</label>
          <input name="chainId" required type="number" placeholder="1" className="luxury-input" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
            Signature Threshold
          </label>
          <input name="threshold" required type="number" min={1} placeholder="2" className="luxury-input" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Vault Address</label>
          <input name="vaultAddress" required placeholder="0x..." className="luxury-input font-mono" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
            Signer Addresses (comma-separated)
          </label>
          <input
            name="signers"
            required
            placeholder="0xabc..., 0xdef..., 0x123..."
            className="luxury-input font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 px-4 transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {pending ? "Saving..." : "Add Vault"}
        </button>
      </form>
      {state.error && <p className="mt-3 text-sm text-red-400">{state.error}</p>}
      {state.success && <p className="mt-3 text-sm text-emerald">Vault registered.</p>}
    </div>
  );
}

function VaultCard({ vault, assets }: { vault: VaultWithReserves; assets: Asset[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleActive() {
    startTransition(async () => {
      await toggleCustodyVaultActive(vault.id, !vault.isActive);
      router.refresh();
    });
  }

  return (
    <div className="luxury-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-zinc-100">{vault.name}</p>
          <p className="text-xs text-zinc-500 font-mono">
            {vault.provider} · chain {vault.chainId} · {vault.threshold}-of-{vault.signers.length}
          </p>
          <p className="text-xs text-zinc-600 font-mono mt-0.5">
            {vault.vaultAddress.slice(0, 10)}…{vault.vaultAddress.slice(-8)}
          </p>
        </div>
        <button
          disabled={isPending}
          onClick={toggleActive}
          className={cn(
            "text-xs rounded-full px-3 py-1.5 border transition disabled:opacity-50 shrink-0",
            vault.isActive
              ? "bg-emerald/10 text-emerald border-emerald/30 hover:bg-emerald/20"
              : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/20"
          )}
        >
          {vault.isActive ? "Active" : "Inactive"}
        </button>
      </div>

      <div className="space-y-2 mb-4">
        {vault.reserves.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-lg border border-zinc-800/60 px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <CryptoIcon symbol={r.asset.symbol} size={24} />
              <p className="text-sm text-zinc-200 font-mono">
                {Number(r.balance).toLocaleString(undefined, { maximumFractionDigits: 8 })} {r.asset.symbol}
              </p>
            </div>
            <p className="text-[11px] text-zinc-600">
              Updated {new Date(r.updatedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
        {vault.reserves.length === 0 && (
          <p className="text-sm text-zinc-500">No reserve balances recorded yet.</p>
        )}
      </div>

      <ReserveForm vaultId={vault.id} assets={assets} />
    </div>
  );
}

function ReserveForm({ vaultId, assets }: { vaultId: string; assets: Asset[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateVaultReserve, initialState);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gold hover:text-gold-light transition">
        + Record reserve balance
      </button>
    );
  }

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end mt-2">
      <input type="hidden" name="vaultId" value={vaultId} />
      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Asset</label>
        <select name="assetId" required className="luxury-input">
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.symbol}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Balance</label>
        <input name="balance" required type="number" step="any" min="0" className="luxury-input" />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-gold hover:bg-gold-light text-obsidian text-sm font-medium py-2 transition disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-800/60 px-3 text-zinc-400 hover:text-zinc-200 transition"
        >
          Cancel
        </button>
      </div>
      {state.error && <p className="sm:col-span-3 text-sm text-red-400">{state.error}</p>}
      {state.success && <p className="sm:col-span-3 text-sm text-emerald">Reserve balance updated.</p>}
    </form>
  );
}
