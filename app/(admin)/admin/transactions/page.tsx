import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import type { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CopyTag from "@/components/CopyTag";
import StatusBadge from "@/components/StatusBadge";

const INCOMING_TYPES = new Set(["DEPOSIT", "MANUAL_CREDIT", "TRANSFER_RECEIVED", "SWAP_CREDIT"]);
const TRANSACTION_TYPES: TransactionType[] = [
  "DEPOSIT",
  "WITHDRAWAL",
  "MANUAL_CREDIT",
  "MANUAL_DEBIT",
  "TRANSFER_SENT",
  "TRANSFER_RECEIVED",
  "SWAP_DEBIT",
  "SWAP_CREDIT",
];
const TRANSACTION_STATUSES: TransactionStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const PAGE_SIZE = 50;

interface Filters {
  q: string;
  type: string;
  status: string;
  asset: string;
  page: number;
}

function parseFilters(raw: Record<string, string | string[] | undefined>): Filters {
  const get = (key: string) => {
    const v = raw[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const pageRaw = Number(get("page"));
  return {
    q: get("q"),
    type: get("type"),
    status: get("status"),
    asset: get("asset").toUpperCase(),
    page: Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1,
  };
}

function buildQueryString(filters: Filters, overrides: Partial<Filters>): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.type) params.set("type", merged.type);
  if (merged.status) params.set("status", merged.status);
  if (merged.asset) params.set("asset", merged.asset);
  if (merged.page > 1) params.set("page", String(merged.page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function TransactionsLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession();
  const filters = parseFilters(await searchParams);

  const where: Prisma.TransactionWhereInput = {};
  if (filters.type && (TRANSACTION_TYPES as string[]).includes(filters.type)) {
    where.type = filters.type as TransactionType;
  }
  if (filters.status && (TRANSACTION_STATUSES as string[]).includes(filters.status)) {
    where.status = filters.status as TransactionStatus;
  }
  if (filters.asset) {
    where.asset = { symbol: filters.asset };
  }
  if (filters.q) {
    where.user = {
      OR: [
        { fullName: { contains: filters.q, mode: "insensitive" } },
        { email: { contains: filters.q, mode: "insensitive" } },
      ],
    };
  }

  const [total, transactions, assets] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { user: true, asset: true },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.asset.findMany({ orderBy: { symbol: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-gold text-[10px] tracking-[0.35em] uppercase mb-1">Custody Operations</p>
        <h1 className="font-serif text-2xl text-zinc-50 flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-gold" />
          Transaction Ledger
        </h1>
      </div>

      <div className="luxury-card p-6 mb-8">
        <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
              Client Name or Email
            </label>
            <input name="q" defaultValue={filters.q} placeholder="Search clients…" className="luxury-input" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Type</label>
            <select name="type" defaultValue={filters.type} className="luxury-input">
              <option value="">All Types</option>
              {TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Status</label>
            <select name="status" defaultValue={filters.status} className="luxury-input">
              <option value="">All Statuses</option>
              {TRANSACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Asset</label>
            <select name="asset" defaultValue={filters.asset} className="luxury-input">
              <option value="">All Assets</option>
              {assets.map((a) => (
                <option key={a.id} value={a.symbol}>
                  {a.symbol}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-5 flex gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-gold hover:bg-gold-light text-obsidian font-medium text-sm py-2.5 px-4 transition"
            >
              Apply Filters
            </button>
            {(filters.q || filters.type || filters.status || filters.asset) && (
              <Link
                href="/admin/transactions"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-800/60 text-zinc-400 hover:text-zinc-200 text-sm py-2.5 px-4 transition"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </div>

      <div className="luxury-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-lg text-zinc-100">
            {total.toLocaleString()} Transaction{total === 1 ? "" : "s"}
          </h2>
          {totalPages > 1 && (
            <span className="text-[11px] text-zinc-600">
              Page {page} of {totalPages}
            </span>
          )}
        </div>

        {transactions.length === 0 ? (
          <p className="text-sm text-zinc-500">No transactions match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800/60">
                  <th className="pb-3 font-normal">Client</th>
                  <th className="pb-3 font-normal">Type</th>
                  <th className="pb-3 font-normal">Asset</th>
                  <th className="pb-3 font-normal">Amount</th>
                  <th className="pb-3 font-normal">Fee</th>
                  <th className="pb-3 font-normal">Reference</th>
                  <th className="pb-3 font-normal">Status</th>
                  <th className="pb-3 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-800/40 last:border-0">
                    <td className="py-3">
                      <Link
                        href={`/admin/clients/${t.userId}`}
                        className="text-zinc-200 hover:text-gold transition truncate max-w-[10rem] inline-block align-middle"
                      >
                        {t.user.fullName}
                      </Link>
                    </td>
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

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <Link
              href={page <= 1 ? "#" : `/admin/transactions${buildQueryString(filters, { page: page - 1 })}`}
              aria-disabled={page <= 1}
              className={`inline-flex items-center gap-1.5 text-xs rounded-lg border border-zinc-800/60 px-3 py-2 transition ${
                page <= 1
                  ? "pointer-events-none text-zinc-700"
                  : "text-zinc-400 hover:text-gold hover:border-gold/30"
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </Link>
            <Link
              href={
                page >= totalPages ? "#" : `/admin/transactions${buildQueryString(filters, { page: page + 1 })}`
              }
              aria-disabled={page >= totalPages}
              className={`inline-flex items-center gap-1.5 text-xs rounded-lg border border-zinc-800/60 px-3 py-2 transition ${
                page >= totalPages
                  ? "pointer-events-none text-zinc-700"
                  : "text-zinc-400 hover:text-gold hover:border-gold/30"
              }`}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
