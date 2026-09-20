"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor, ShieldOff } from "lucide-react";
import { revokeSession } from "@/actions/admin-actions";

export interface SessionRow {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

export default function ActiveSessionsPanel({
  userId,
  sessions,
}: {
  userId: string;
  sessions: SessionRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function revoke(sessionId: string) {
    setError(null);
    setPendingId(sessionId);
    startTransition(async () => {
      const result = await revokeSession(sessionId, userId);
      if (result.error) setError(result.error);
      setPendingId(null);
      router.refresh();
    });
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-zinc-500">No sessions recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const active = !s.revokedAt;
        return (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/60 px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Monitor className={`w-4 h-4 shrink-0 ${active ? "text-emerald" : "text-zinc-600"}`} />
              <div className="min-w-0">
                <p className="text-xs text-zinc-300 truncate">
                  {s.userAgent ?? "Unknown device"}
                </p>
                <p className="text-[11px] text-zinc-600">
                  {s.ipAddress ?? "Unknown IP"} · last seen {s.lastSeenAt.toLocaleString()}
                </p>
              </div>
            </div>
            {active ? (
              <button
                disabled={isPending && pendingId === s.id}
                onClick={() => revoke(s.id)}
                className="shrink-0 flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition disabled:opacity-50"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                Revoke
              </button>
            ) : (
              <span className="shrink-0 text-[11px] text-zinc-600">Revoked</span>
            )}
          </div>
        );
      })}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
