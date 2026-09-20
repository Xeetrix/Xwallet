"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignUnattributedDeposit } from "@/actions/admin-actions";

export default function AssignDepositAction({
  depositId,
  clients,
}: {
  depositId: string;
  clients: { id: string; fullName: string; email: string }[];
}) {
  const [userId, setUserId] = useState(clients[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function assign() {
    if (!userId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignUnattributedDeposit(depositId, userId);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="luxury-input !py-1.5 !text-xs max-w-[10rem]"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
        <button
          disabled={isPending || !userId}
          onClick={assign}
          className="text-xs rounded-full px-3 py-1.5 bg-emerald/10 text-emerald border border-emerald/30 hover:bg-emerald/20 transition disabled:opacity-50 whitespace-nowrap"
        >
          Assign
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
