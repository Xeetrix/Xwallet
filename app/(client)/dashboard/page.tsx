import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowDownToLine, ArrowUpRight, Wallet } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import DepositModal from "@/components/DepositModal";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [balances, assets, transactions] = await Promise.all([
    prisma.userBalance.findMany({
      where: { userId: session.sub },
      include: { asset: true },
      orderBy: { balance: "desc" },
    }),
    prisma.asset.findMany({
      where: { isActive: true },
      include: { networkAddresses: { where: { isActive: true } } },
      orderBy: { symbol: "asc" },
    }),
    prisma.transaction.findMany({
      where: { userId: session.sub },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const pendingDepositCount = transactions.filter(
    (t) => t.type === "DEPOSIT" && t.status === "PENDING"
  ).length;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Portfolio Overview</p>
          <h1 className="font-serif text-2xl text-zinc-50">
            Welcome back, {session.fullName.split(" ")[0]}
          </h1>
        </div>
        <DepositModal assets={assets} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="luxury-card p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Active Positions</p>
          <p className="font-serif text-2xl text-zinc-50">{balances.length}</p>
        </div>
        <div className="luxury-card p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Pending Deposits</p>
          <p className="font-serif text-2xl text-gold">{pendingDepositCount}</p>
        </div>
        <div className="luxury-card p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Account Status</p>
          <p className="font-serif text-2xl text-emerald">Active</p>
        </div>
      </div>

      <div className="luxury-card p-6 mb-8">
        <h2 className="font-serif text-lg text-zinc-100 mb-5 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gold" />
          Asset Holdings
        </h2>
        {balances.length === 0 ? (
          <p className="text-sm text-zinc-500">No holdings yet. Submit a deposit to get started.</p>
        ) : (
          <div className="space-y-3">
            {balances.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  {b.asset.logoUrl ? (
                    <Image
                      src={b.asset.logoUrl}
                      alt={b.asset.symbol}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-[10px] text-gold font-medium">
                      {b.asset.symbol.slice(0, 3)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-zinc-100">{b.asset.name}</p>
                    <p className="text-xs text-zinc-500">{b.asset.symbol}</p>
                  </div>
                </div>
                <p className="font-serif text-zinc-50">
                  {Number(b.balance).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="luxury-card p-6">
        <h2 className="font-serif text-lg text-zinc-100 mb-5">Recent Ledger Activity</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-zinc-500">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-line">
                  <th className="pb-3 font-normal">Type</th>
                  <th className="pb-3 font-normal">Asset</th>
                  <th className="pb-3 font-normal">Amount</th>
                  <th className="pb-3 font-normal">Status</th>
                  <th className="pb-3 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-line/60 last:border-0">
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        {t.type === "DEPOSIT" || t.type === "MANUAL_CREDIT" ? (
                          <ArrowDownToLine className="w-3.5 h-3.5 text-emerald" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                        )}
                        {t.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-400">{t.asset.symbol}</td>
                    <td className="py-3 text-zinc-100">
                      {Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full border",
                          t.status === "APPROVED" && "text-emerald border-emerald/30 bg-emerald/10",
                          t.status === "REJECTED" && "text-red-400 border-red-500/30 bg-red-500/10",
                          t.status === "PENDING" && "text-gold border-gold/30 bg-gold/10"
                        )}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-500">{t.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
