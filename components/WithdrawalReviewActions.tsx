"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewWithdrawal, executeQueuedWithdrawal } from "@/actions/admin-actions";

export interface MultisigProposal {
  vaultAddress: string;
  chainId: number;
  threshold: number;
  signers: string[];
}

export default function WithdrawalReviewActions({
  transactionId,
  status,
  multisigProposal,
}: {
  transactionId: string;
  status: "PENDING" | "QUEUED";
  multisigProposal?: MultisigProposal | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState("");
  const router = useRouter();

  function review(action: "APPROVE" | "REJECT") {
    setError(null);
    startTransition(async () => {
      const result = await reviewWithdrawal(transactionId, action);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function execute() {
    setError(null);
    startTransition(async () => {
      const result = await executeQueuedWithdrawal(transactionId, txHash);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  if (status === "QUEUED") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {multisigProposal && (
          <p className="text-[11px] text-zinc-500 max-w-[16rem] text-right leading-relaxed">
            Queued for {multisigProposal.threshold}-of-{multisigProposal.signers.length} sign-off from{" "}
            <span className="font-mono">
              {multisigProposal.vaultAddress.slice(0, 8)}…{multisigProposal.vaultAddress.slice(-6)}
            </span>
          </p>
        )}
        <input
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          disabled={isPending}
          placeholder="Executed tx hash"
          className="luxury-input !py-1.5 !px-2.5 text-xs w-48 disabled:opacity-50"
        />
        <button
          disabled={isPending || !txHash.trim()}
          onClick={execute}
          className="text-xs rounded-full px-3 py-1.5 bg-emerald/10 text-emerald border border-emerald/30 hover:bg-emerald/20 transition disabled:opacity-50"
        >
          Confirm Executed
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() => review("APPROVE")}
          className="text-xs rounded-full px-3 py-1.5 bg-emerald/10 text-emerald border border-emerald/30 hover:bg-emerald/20 transition disabled:opacity-50"
        >
          Approve &amp; Queue
        </button>
        <button
          disabled={isPending}
          onClick={() => review("REJECT")}
          className="text-xs rounded-full px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition disabled:opacity-50"
        >
          Reject &amp; Refund
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
