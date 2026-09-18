import { Clock, Coins, ShieldCheck, Users, Vault } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fetchUsdPrices } from "@/lib/pricing";
import UserStatusActions from "@/components/UserStatusActions";
import DepositReviewActions from "@/components/DepositReviewActions";
import ManualAdjustModal from "@/components/ManualAdjustModal";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import CopyTag from "@/components/CopyTag";
import CryptoIcon from "@/components/CryptoIcon";

export default async function AdminConsolePage() {
  const [pendingUsers, otherUsers, pendingDeposits, assets, allBalances] = await Promise.all([
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
    prisma.userBalance.findMany({ include: { asset: true } }),
  ]);

  const activeClientCount = otherUsers.filter((u) => u.status === "ACTIVE").length;

  const prices = await fetchUsdPrices(allBalances.map((b) => b.asset.symbol));
  const totalCustodyValue = allBalances.reduce((sum, b) => {
    const price = prices[b.asset.symbol.toUpperCase()];
    return typeof price === "number" ? sum + Number(b.balance) * price : sum;
  }, 0);
  const custodyHasPricing = allBalances.some((b) => typeof prices[b.asset.symbol.toUpperCase()] === "number");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Master Console</p>
          <h1 className="font-serif text-2xl text-zinc-50">Custody Operations</h1>
        </div>
        <ManualAdjustModal clients={otherUsers} assets={assets} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Total Custody Value"
          icon={Vault}
          tone="gold"
          valueTone="gold"
          value={
            custodyHasPricing
              ? totalCustodyValue.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })
              : "—"
          }
        />
        <StatCard
          label="Pending Approvals"
          icon={Clock}
          tone={pendingUsers.length > 0 ? "gold" : "zinc"}
          valueTone={pendingUsers.length > 0 ? "gold" : "zinc"}
          value={pendingUsers.length}
        />
        <StatCard
          label="Pending Deposits"
          icon={Coins}
          tone={pendingDeposits.length > 0 ? "gold" : "zinc"}
          valueTone={pendingDeposits.length > 0 ? "gold" : "zinc"}
          value={pendingDeposits.length}
        />
        <StatCard label="Active Clients" icon={Users} tone="emerald" valueTone="emerald" value={activeClientCount} />
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
                className="flex items-center justify-between rounded-xl border border-zinc-800/60 px-4 py-3.5"
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
                className="flex items-center justify-between rounded-xl border border-zinc-800/60 px-4 py-3.5 gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CryptoIcon symbol={t.asset.symbol} size={32} />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100 truncate">
                      {t.user.fullName}{" "}
                      <span className="text-zinc-500 font-mono">
                        · {Number(t.amount).toLocaleString()} {t.asset.symbol}
                      </span>
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] text-zinc-600 uppercase tracking-wide">
                        {t.networkName}
                      </span>
                      {t.txHash && (
                        <CopyTag
                          value={t.txHash}
                          label={`${t.txHash.slice(0, 8)}…${t.txHash.slice(-6)}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <DepositReviewActions transactionId={t.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="luxury-card p-6">
        <h2 className="font-serif text-lg text-zinc-100 mb-5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gold" />
          Client Directory
        </h2>
        {otherUsers.length === 0 ? (
          <p className="text-sm text-zinc-500">No clients yet.</p>
        ) : (
          <div className="space-y-3">
            {otherUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800/60 px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm text-zinc-100">{u.fullName}</p>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </div>
                  <StatusBadge status={u.status} />
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
