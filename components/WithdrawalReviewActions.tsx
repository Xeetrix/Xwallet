"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewWithdrawal } from "@/actions/admin-actions";

export default function WithdrawalReviewActions({ transactionId }: { transactionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState("");
  const router = useRouter();

  function act(action: "APPROVE" | "REJECT") {
    setError(null);
    startTransition(async () => {
      const result = await reviewWithdrawal(transactionId, action, txHash);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <input
        value={txHash}
        onChange={(e) => setTxHash(e.target.value)}
        disabled={isPending}
        placeholder="Outgoing tx hash (optional)"
        className="luxury-input !py-1.5 !px-2.5 text-xs w-48 disabled:opacity-50"
      />
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() => act("APPROVE")}
          className="text-xs rounded-full px-3 py-1.5 bg-emerald/10 text-emerald border border-emerald/30 hover:bg-emerald/20 transition disabled:opacity-50"
        >
          Mark Sent
        </button>
        <button
          disabled={isPending}
          onClick={() => act("REJECT")}
          className="text-xs rounded-full px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition disabled:opacity-50"
        >
          Reject &amp; Refund
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
