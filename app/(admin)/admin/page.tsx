import { Clock, Coins, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import UserStatusActions from "@/components/UserStatusActions";
import DepositReviewActions from "@/components/DepositReviewActions";
import ManualAdjustModal from "@/components/ManualAdjustModal";

export default async function AdminConsolePage() {
  const [pendingUsers, otherUsers, pendingDeposits, assets] = await Promise.all([
    prisma.user.findMany({ where: { status: "PENDING_APPROVAL" }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      where: { role: "CLIENT", status: { not: "PENDING_APPROVAL" } },
      orderBy: { fullName: "asc" },
    }),
    prisma.transaction.findMany({
      where: { type: "DEPOSIT", status: "PENDING" },
      include: { user: true, asset: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.asset.findMany({ where: { isActive: true }, orderBy: { symbol: "asc" } }),
  ]);

  const activeClientCount = otherUsers.filter((u) => u.status === "ACTIVE").length;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Master Console</p>
          <h1 className="font-serif text-2xl text-zinc-50">Custody Operations</h1>
        </div>
        <ManualAdjustModal clients={otherUsers} assets={assets} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="luxury-card p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending Approvals
          </p>
          <p className="font-serif text-2xl text-gold">{pendingUsers.length}</p>
        </div>
        <div className="luxury-card p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" /> Deposits Awaiting Review
          </p>
          <p className="font-serif text-2xl text-gold">{pendingDeposits.length}</p>
        </div>
        <div className="luxury-card p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Active Clients
          </p>
          <p className="font-serif text-2xl text-zinc-50">{activeClientCount}</p>
        </div>
      </div>

      <div className="luxury-card p-6 mb-8">
        <h2 className="font-serif text-lg text-zinc-100 mb-5">Pending Account Approvals</h2>
        {pendingUsers.length === 0 ? (
          <p className="text-sm text-zinc-500">No applications awaiting review.</p>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3.5"
              >
                <div>
                  <p className="text-sm text-zinc-100">{u.fullName}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </div>
                <UserStatusActions userId={u.id} status={u.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="luxury-card p-6 mb-8">
        <h2 className="font-serif text-lg text-zinc-100 mb-5">Deposit Verification Queue</h2>
        {pendingDeposits.length === 0 ? (
          <p className="text-sm text-zinc-500">No deposits awaiting verification.</p>
        ) : (
          <div className="space-y-3">
            {pendingDeposits.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3.5 gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100">
                    {t.user.fullName}{" "}
                    <span className="text-zinc-500">
                      — {Number(t.amount).toLocaleString()} {t.asset.symbol}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500 truncate max-w-md font-mono">
                    {t.networkName} · {t.txHash}
                  </p>
                </div>
                <DepositReviewActions transactionId={t.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="luxury-card p-6">
        <h2 className="font-serif text-lg text-zinc-100 mb-5">Client Directory</h2>
        {otherUsers.length === 0 ? (
          <p className="text-sm text-zinc-500">No clients yet.</p>
        ) : (
          <div className="space-y-3">
            {otherUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3.5"
              >
                <div>
                  <p className="text-sm text-zinc-100">{u.fullName}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </div>
                <UserStatusActions userId={u.id} status={u.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
