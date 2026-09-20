"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KycTier } from "@prisma/client";
import { updateClientKyc } from "@/actions/admin-actions";

export default function KycSettingsForm({
  userId,
  kycTier,
  dailyLimitUsd,
  monthlyLimitUsd,
}: {
  userId: string;
  kycTier: KycTier;
  dailyLimitUsd: number | null;
  monthlyLimitUsd: number | null;
}) {
  const [tier, setTier] = useState<KycTier>(kycTier);
  const [daily, setDaily] = useState(dailyLimitUsd?.toString() ?? "");
  const [monthly, setMonthly] = useState(monthlyLimitUsd?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateClientKyc(
        userId,
        tier,
        daily.trim() === "" ? null : Number(daily),
        monthly.trim() === "" ? null : Number(monthly)
      );
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">KYC Tier</label>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as KycTier)}
          className="luxury-input"
        >
          <option value="BASIC">Basic</option>
          <option value="VERIFIED">Verified</option>
          <option value="INSTITUTIONAL">Institutional</option>
        </select>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
          Daily Limit (USD)
        </label>
        <input
          type="number"
          min="0"
          step="any"
          value={daily}
          onChange={(e) => setDaily(e.target.value)}
          placeholder="Unlimited"
          className="luxury-input font-mono"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
          Monthly Limit (USD)
        </label>
        <input
          type="number"
          min="0"
          step="any"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          placeholder="Unlimited"
          className="luxury-input font-mono"
        />
      </div>
      <div className="sm:col-span-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm px-4 py-2 transition disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save Compliance Settings"}
        </button>
        {saved && <span className="text-xs text-emerald">Saved.</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </form>
  );
}
