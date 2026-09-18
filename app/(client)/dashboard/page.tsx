import { redirect } from "next/navigation";
import { ArrowDownToLine, ArrowUpRight, CircleDollarSign, Layers, ShieldCheck, Wallet } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchUsdPrices } from "@/lib/pricing";
import DepositModal from "@/components/DepositModal";
import TransferModal from "@/components/TransferModal";
import WithdrawModal from "@/components/WithdrawModal";
import ConvertModal from "@/components/ConvertModal";
import CryptoIcon from "@/components/CryptoIcon";
import CopyTag from "@/components/CopyTag";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";

const INCOMING_TYPES = new Set(["DEPOSIT", "MANUAL_CREDIT", "TRANSFER_RECEIVED", "SWAP_CREDIT"]);

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [balances, assets, transactions] = await Promise.all([
    prisma.userBalance.findMany({
      where: { userId: session.sub },
      include: { asset: { include: { networkAddresses: { where: { isActive: true } } } } },
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

  const prices = await fetchUsdPrices(balances.map((b) => b.asset.symbol));

  const holdings = balances.map((b) => {
    const amount = Number(b.balance);
    const price = prices[b.asset.symbol.toUpperCase()];
    const usdValue = typeof price === "number" ? amount * price : null;
    return { balance: b, amount, price, usdValue };
  });

  const totalUsdValue = holdings.reduce((sum, h) => sum + (h.usdValue ?? 0), 0);
  const pricedHoldingsCount = holdings.filter((h) => h.usdValue !== null).length;
  const hasAnyPricing = pricedHoldingsCount > 0;
  const hasFullPricing = holdings.length > 0 && pricedHoldingsCount === holdings.length;

  const pendingDepositCount = transactions.filter(
    (t) => t.type === "DEPOSIT" && t.status === "PENDING"
  ).length;

  // Prisma's Decimal is a class instance and can't cross the server->client
  // boundary as a prop (React Server Components only serialize plain data),
  // so the modals below receive a plain-number version instead of the raw
  // query result.
  const serializedBalances = balances.map((b) => ({ ...b, balance: Number(b.balance) }));

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Portfolio Overview</p>
          <h1 className="font-serif text-2xl text-zinc-50">
            Welcome back, {session.fullName.split(" ")[0]}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ConvertModal balances={serializedBalances} assets={assets} />
          <TransferModal balances={serializedBalances} />
          <WithdrawModal balances={serializedBalances} />
          <DepositModal assets={assets} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Estimated Net Worth"
          icon={CircleDollarSign}
          tone="gold"
          valueTone="gold"
          value={
            holdings.length === 0
              ? "$0.00"
              : hasAnyPricing
                ? totalUsdValue.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 2,
                  })
                : "—"
          }
        />
        <StatCard label="Active Positions" icon={Layers} value={balances.length} />
        <StatCard
          label="Pending Deposits"
          icon={Wallet}
          tone={pendingDepositCount > 0 ? "gold" : "zinc"}
          valueTone={pendingDepositCount > 0 ? "gold" : "zinc"}
          value={pendingDepositCount}
        />
        <StatCard label="Account Status" icon={ShieldCheck} tone="emerald" valueTone="emerald" value="Active" />
      </div>

      <div className="luxury-card p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-lg text-zinc-100 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-gold" />
            Asset Holdings
          </h2>
          {!hasFullPricing && holdings.length > 0 && (
            <span className="text-[11px] text-zinc-600">USD values shown where price data is available</span>
          )}
        </div>
        {holdings.length === 0 ? (
          <p className="text-sm text-zinc-500">No holdings yet. Submit a deposit to get started.</p>
        ) : (
          <div className="space-y-3">
            {holdings.map(({ balance: b, amount, usdValue }) => {
              const allocationPct = totalUsdValue > 0 && usdValue !== null ? (usdValue / totalUsdValue) * 100 : 0;
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-zinc-800/60 px-4 py-3.5 transition hover:border-gold/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CryptoIcon symbol={b.asset.symbol} size={32} />
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-100 truncate">{b.asset.name}</p>
                        <p className="text-xs text-zinc-500">{b.asset.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono tabular-nums text-zinc-50">
                        {amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {usdValue !== null
                          ? usdValue.toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 2,
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {totalUsdValue > 0 && usdValue !== null && (
                    <div className="mt-3 h-1 w-full rounded-full bg-zinc-800/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold"
                        style={{ width: `${Math.max(allocationPct, 1.5)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
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
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800/60">
                  <th className="pb-3 font-normal">Type</th>
                  <th className="pb-3 font-normal">Asset</th>
                  <th className="pb-3 font-normal">Amount</th>
                  <th className="pb-3 font-normal">Reference</th>
                  <th className="pb-3 font-normal">Status</th>
                  <th className="pb-3 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-800/40 last:border-0">
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        {INCOMING_TYPES.has(t.type) ? (
                          <ArrowDownToLine className="w-3.5 h-3.5 text-emerald" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                        )}
                        {t.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-400">{t.asset.symbol}</td>
                    <td className="py-3 text-zinc-100 font-mono tabular-nums">
                      {Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </td>
                    <td className="py-3">
                      {t.txHash ? (
                        <CopyTag value={t.txHash} label={`${t.txHash.slice(0, 6)}…${t.txHash.slice(-4)}`} />
                      ) : t.referenceNote ? (
                        <span className="text-xs text-zinc-500 italic truncate max-w-[12rem] inline-block align-middle">
                          {t.referenceNote}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={t.status} />
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
