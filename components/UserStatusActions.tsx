"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserStatus } from "@prisma/client";
import { toggleUserStatus } from "@/actions/admin-actions";

export default function UserStatusActions({
  userId,
  status,
}: {
  userId: string;
  status: UserStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function change(next: UserStatus) {
    setError(null);
    startTransition(async () => {
      const result = await toggleUserStatus(userId, next);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status === "PENDING_APPROVAL" && (
          <>
            <button
              disabled={isPending}
              onClick={() => change("ACTIVE")}
              className="text-xs rounded-full px-3 py-1.5 bg-emerald/10 text-emerald border border-emerald/30 hover:bg-emerald/20 transition disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={isPending}
              onClick={() => change("SUSPENDED")}
              className="text-xs rounded-full px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {status === "ACTIVE" && (
          <button
            disabled={isPending}
            onClick={() => change("SUSPENDED")}
            className="text-xs rounded-full px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition disabled:opacity-50"
          >
            Suspend
          </button>
        )}
        {status === "SUSPENDED" && (
          <button
            disabled={isPending}
            onClick={() => change("ACTIVE")}
            className="text-xs rounded-full px-3 py-1.5 bg-emerald/10 text-emerald border border-emerald/30 hover:bg-emerald/20 transition disabled:opacity-50"
          >
            Reactivate
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
