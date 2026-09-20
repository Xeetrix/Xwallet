import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CopyTag from "@/components/CopyTag";
import AssignDepositAction from "@/components/AssignDepositAction";

export const metadata: Metadata = {
  title: "Unattributed Deposits",
  robots: { index: false, follow: false },
};

export default async function UnattributedDepositsPage() {
  await requireAdminSession();

  const [pending, assigned, clients] = await Promise.all([
    prisma.unattributedDeposit.findMany({
      where: { status: "PENDING" },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.unattributedDeposit.findMany({
      where: { status: "ASSIGNED" },
      include: { asset: true, assignedUser: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.user.findMany({
      where: { role: "CLIENT" },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Custody Operations</p>
        <h1 className="font-serif text-2xl text-zinc-50 flex items-center gap-2">
          <Inbox className="w-5 h-5 text-gold" />
          Unattributed Deposits
        </h1>
        <p className="text-sm text-zinc-500 mt-2">
          On-chain deposits reported by the deposit webhook that couldn&apos;t be matched to a
          client-submitted deposit by transaction hash. Assign each to the correct client to credit
          their balance.
        </p>
      </div>

      <div className="luxury-card p-6 mb-8">
        <h2 className="font-serif text-lg text-zinc-100 mb-5">
          Pending Assignment ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing waiting on assignment.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((d) => (
              <div
                key={d.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-zinc-800/60 px-4 py-3.5"
              >
                <div>
                  <p className="text-sm text-zinc-100">
                    {Number(d.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })}{" "}
                    {d.asset.symbol}{" "}
                    <span className="text-zinc-600 text-xs">via {d.networkName}</span>
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <CopyTag value={d.txHash} label={`${d.txHash.slice(0, 8)}…${d.txHash.slice(-6)}`} />
                    <span className="text-xs text-zinc-600">{d.createdAt.toLocaleString()}</span>
                  </div>
                </div>
                <AssignDepositAction depositId={d.id} clients={clients} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="luxury-card p-6">
        <h2 className="font-serif text-lg text-zinc-100 mb-5">Recently Assigned</h2>
        {assigned.length === 0 ? (
          <p className="text-sm text-zinc-500">No assignments yet.</p>
        ) : (
          <div className="space-y-2">
            {assigned.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between text-sm rounded-lg border border-zinc-800/40 px-3.5 py-2.5"
              >
                <span className="text-zinc-300">
                  {Number(d.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })} {d.asset.symbol}
                </span>
                <span className="text-zinc-500 truncate max-w-[12rem]">{d.assignedUser?.email}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
