import Link from "next/link";
import { ArrowUpFromLine, Clock, ScrollText, ShieldCheck, Users, Vault } from "lucide-react";
import type { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchUsdPrices } from "@/lib/pricing";
import UserStatusActions from "@/components/UserStatusActions";
import DepositReviewActions from "@/components/DepositReviewActions";
import WithdrawalReviewActions from "@/components/WithdrawalReviewActions";
import ManualAdjustModal from "@/components/ManualAdjustModal";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import CopyTag from "@/components/CopyTag";
import CryptoIcon from "@/components/CryptoIcon";

const DIRECTORY_STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED"];

export default async function AdminConsolePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const getParam = (key: string) => {
    const v = rawParams[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const clientQuery = getParam("q");
  const clientStatusFilter = getParam("status").toUpperCase();
  const activeStatusFilter = (DIRECTORY_STATUSES as string[]).includes(clientStatusFilter)
    ? (clientStatusFilter as UserStatus)
    : null;

  const directoryWhere: Prisma.UserWhereInput = {
    role: "CLIENT",
    status: activeStatusFilter ? activeStatusFilter : { in: DIRECTORY_STATUSES },
    ...(clientQuery
      ? {
          OR: [
            { fullName: { contains: clientQuery, mode: "insensitive" } },
            { email: { contains: clientQuery, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [
    pendingUsers,
    otherUsers,
    allClientsForAdjustment,
    pendingDeposits,
    pendingWithdrawals,
    assets,
    allBalances,
  ] = await Promise.all([
    prisma.user.findMany({ where: { status: "PENDING_APPROVAL" }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      where: directoryWhere,
      orderBy: { fullName: "asc" },
    }),
    // Unfiltered client list for the manual-adjustment picker, so a
    // directory search/status filter above doesn't also narrow who can
    // be selected for a balance adjustment. Selected down to just the
    // fields the (client-rendered) modal needs — never pass a full User
    // row to a "use client" component, since it would serialize
    // passwordHash straight into the page source.
    prisma.user.findMany({
      where: { role: "CLIENT", status: { in: DIRECTORY_STATUSES } },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.transaction.findMany({
      where: { type: "DEPOSIT", status: "PENDING" },
      include: { user: true, asset: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { type: "WITHDRAWAL", status: "PENDING" },
      include: { user: true, asset: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.asset.findMany({ where: { isActive: true }, orderBy: { symbol: "asc" } }),
    prisma.userBalance.findMany({ include: { asset: true } }),
  ]);

  const activeClientCount = await prisma.user.count({ where: { role: "CLIENT", status: "ACTIVE" } });

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
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/transactions"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/60 hover:border-gold/30 text-zinc-300 hover:text-gold text-sm font-medium px-4 py-2.5 transition"
          >
            <ScrollText className="w-4 h-4" />
            Transaction Ledger
          </Link>
          <ManualAdjustModal clients={allClientsForAdjustment} assets={assets} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Custody Value"
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
          label="Pending Reviews"
          icon={ArrowUpFromLine}
          tone={pendingDeposits.length + pendingWithdrawals.length > 0 ? "gold" : "zinc"}
          valueTone={pendingDeposits.length + pendingWithdrawals.length > 0 ? "gold" : "zinc"}
          value={pendingDeposits.length + pendingWithdrawals.length}
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
                      <Link href={`/admin/clients/${t.userId}`} className="hover:text-gold transition">
                        {t.user.fullName}
                      </Link>{" "}
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

      <div className="luxury-card p-6 mb-8">
        <h2 className="font-serif text-lg text-zinc-100 mb-5">Withdrawal Requests</h2>
        {pendingWithdrawals.length === 0 ? (
          <p className="text-sm text-zinc-500">No withdrawals awaiting processing.</p>
        ) : (
          <div className="space-y-3">
            {pendingWithdrawals.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800/60 px-4 py-3.5 gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CryptoIcon symbol={t.asset.symbol} size={32} />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100 truncate">
                      <Link href={`/admin/clients/${t.userId}`} className="hover:text-gold transition">
                        {t.user.fullName}
                      </Link>{" "}
                      <span className="text-zinc-500 font-mono">
                        · {Number(t.amount).toLocaleString()} {t.asset.symbol}
                      </span>
                      {t.feeAmount && (
                        <span className="text-zinc-600 font-mono">
                          {" "}
                          (incl. {Number(t.feeAmount).toLocaleString()} fee)
                        </span>
                      )}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] text-zinc-600 uppercase tracking-wide">
                        {t.networkName}
                      </span>
                      {t.destinationAddress && (
                        <CopyTag
                          value={t.destinationAddress}
                          label={`${t.destinationAddress.slice(0, 8)}…${t.destinationAddress.slice(-6)}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <WithdrawalReviewActions transactionId={t.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="luxury-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <h2 className="font-serif text-lg text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gold" />
            Client Directory
          </h2>
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800/60 bg-black/30 p-1 text-xs">
            {(
              [
                { label: "All", value: "" },
                { label: "Active", value: "ACTIVE" },
                { label: "Suspended", value: "SUSPENDED" },
              ] as const
            ).map((opt) => (
              <Link
                key={opt.label}
                href={`/admin${
                  opt.value || clientQuery
                    ? `?${new URLSearchParams({
                        ...(clientQuery ? { q: clientQuery } : {}),
                        ...(opt.value ? { status: opt.value } : {}),
                      }).toString()}`
                    : ""
                }`}
                className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                  (opt.value || "") === (activeStatusFilter ?? "")
                    ? "bg-gold/15 text-gold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        <form className="mb-5">
          {clientStatusFilter && <input type="hidden" name="status" value={clientStatusFilter} />}
          <input
            name="q"
            defaultValue={clientQuery}
            placeholder="Search by name or email…"
            className="luxury-input"
          />
        </form>

        {otherUsers.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {clientQuery || activeStatusFilter ? "No clients match these filters." : "No clients yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {otherUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800/60 px-4 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/clients/${u.id}`}
                      className="text-sm text-zinc-100 hover:text-gold transition truncate block"
                    >
                      {u.fullName}
                    </Link>
                    <p className="text-xs text-zinc-500 truncate">{u.email}</p>
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
