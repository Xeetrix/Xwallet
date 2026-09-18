import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  CircleDollarSign,
  Layers,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchUsdPrices } from "@/lib/pricing";
import CryptoIcon from "@/components/CryptoIcon";
import CopyTag from "@/components/CopyTag";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";
import UserStatusActions from "@/components/UserStatusActions";
import ManualAdjustModal from "@/components/ManualAdjustModal";

const INCOMING_TYPES = new Set(["DEPOSIT", "MANUAL_CREDIT", "TRANSFER_RECEIVED", "SWAP_CREDIT"]);

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;

  const client = await prisma.user.findUnique({ where: { id } });
  if (!client || client.role !== "CLIENT") notFound();

  const [balances, transactions, assets] = await Promise.all([
    prisma.userBalance.findMany({
      where: { userId: id },
      include: { asset: true },
      orderBy: { balance: "desc" },
    }),
    prisma.transaction.findMany({
      where: { userId: id },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.asset.findMany({ where: { isActive: true }, orderBy: { symbol: "asc" } }),
  ]);

  const prices = await fetchUsdPrices(balances.map((b) => b.asset.symbol));
  const holdings = balances.map((b) => {
    const amount = Number(b.balance);
    const price = prices[b.asset.symbol.toUpperCase()];
    const usdValue = typeof price === "number" ? amount * price : null;
    return { balance: b, amount, usdValue };
  });
  const totalUsdValue = holdings.reduce((sum, h) => sum + (h.usdValue ?? 0), 0);
  const hasAnyPricing = holdings.some((h) => h.usdValue !== null);

  const approvedDepositCount = transactions.filter(
    (t) => t.type === "DEPOSIT" && t.status === "APPROVED"
  ).length;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-gold transition mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Console
      </Link>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Client Profile</p>
          <h1 className="font-serif text-2xl text-zinc-50">{client.fullName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span className="text-sm text-zinc-500">{client.email}</span>
            <StatusBadge status={client.status} />
            <span className="text-xs text-zinc-600">Joined {client.createdAt.toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ManualAdjustModal
            clients={[{ id: client.id, fullName: client.fullName, email: client.email }]}
            assets={assets}
          />
          <UserStatusActions userId={client.id} status={client.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Net Worth"
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
        <StatCard label="Approved Deposits" icon={Wallet} value={approvedDepositCount} />
        <StatCard
          label="Total Transactions"
          icon={ShieldCheck}
          tone="emerald"
          valueTone="emerald"
          value={transactions.length}
        />
      </div>

      <div className="luxury-card p-6 mb-8">
        <h2 className="font-serif text-lg text-zinc-100 mb-5">Asset Holdings</h2>
        {holdings.length === 0 ? (
          <p className="text-sm text-zinc-500">No holdings yet.</p>
        ) : (
          <div className="space-y-3">
            {holdings.map(({ balance: b, amount, usdValue }) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800/60 px-4 py-3.5"
              >
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
            ))}
          </div>
        )}
      </div>

      <div className="luxury-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-lg text-zinc-100">Transaction History</h2>
          {transactions.length === 100 && (
            <span className="text-[11px] text-zinc-600">Showing most recent 100</span>
          )}
        </div>
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
                  <th className="pb-3 font-normal">Fee</th>
                  <th className="pb-3 font-normal">Counterparty</th>
                  <th className="pb-3 font-normal">Reference</th>
                  <th className="pb-3 font-normal">Status</th>
                  <th className="pb-3 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-800/40 last:border-0">
                    <td className="py-3">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        {INCOMING_TYPES.has(t.type) ? (
                          <ArrowDownToLine className="w-3.5 h-3.5 text-emerald shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        {t.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-400">{t.asset.symbol}</td>
                    <td className="py-3 text-zinc-100 font-mono tabular-nums">
                      {Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </td>
                    <td className="py-3 text-zinc-500 font-mono tabular-nums">
                      {t.feeAmount
                        ? Number(t.feeAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })
                        : "—"}
                    </td>
                    <td className="py-3 text-zinc-500 truncate max-w-[10rem]">
                      {t.counterpartyEmail ?? "—"}
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
                    <td className="py-3 text-zinc-500 whitespace-nowrap">
                      {t.createdAt.toLocaleDateString()}
                    </td>
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
