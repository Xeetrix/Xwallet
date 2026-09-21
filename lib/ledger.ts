import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Fixed system account labels used as LedgerEntry.accountId for the
// counterparty side of an entry that doesn't belong to a real client —
// deliberately not User rows, since they don't represent a person with a
// login. SYSTEM_RESERVE absorbs the platform side of deposits, withdrawals,
// and conversions; GAS_FEE_COLLECTOR absorbs every network-fee debit.
export const SYSTEM_RESERVE_ACCOUNT = "SYSTEM_RESERVE";
export const GAS_FEE_COLLECTOR_ACCOUNT = "GAS_FEE_COLLECTOR";

export interface LedgerEntryInput {
  accountId: string;
  assetId: string;
  direction: "DEBIT" | "CREDIT";
  amount: number | Prisma.Decimal;
}

/**
 * Writes a set of ledger entries for one transactionId, inside an
 * already-open Prisma interactive transaction (`tx`) — call this in the
 * same `$transaction` callback as the UserBalance mutation it describes,
 * after the Transaction row itself has been created (its id is the
 * required transactionId here). Every call site is responsible for
 * constructing a set that balances per asset (sum of DEBIT amounts equals
 * sum of CREDIT amounts for each assetId in the set) — see the callers in
 * actions/client-actions.ts and actions/admin-actions.ts for the pattern.
 */
export async function writeLedgerEntries(
  tx: Prisma.TransactionClient,
  transactionId: string,
  entries: LedgerEntryInput[]
): Promise<void> {
  if (entries.length === 0) return;
  await tx.ledgerEntry.createMany({
    data: entries.map((e) => ({
      transactionId,
      accountId: e.accountId,
      assetId: e.assetId,
      direction: e.direction,
      amount: e.amount,
    })),
  });
}

export interface BalanceDiscrepancy {
  accountId: string;
  accountLabel: string;
  assetSymbol: string;
  balanceAmount: number;
  ledgerAmount: number;
  difference: number;
}

/**
 * Compares every real client's UserBalance against the net of their
 * LedgerEntry rows (sum of CREDIT minus sum of DEBIT) for the same asset.
 * An empty result means the double-entry ledger perfectly reconstructs
 * every tracked client balance — the core invariant this dual-write
 * architecture exists to make provable.
 */
export async function reconcileLedger(): Promise<BalanceDiscrepancy[]> {
  const [balances, ledgerSums, users] = await Promise.all([
    prisma.userBalance.findMany({ include: { asset: true } }),
    prisma.ledgerEntry.groupBy({
      by: ["accountId", "assetId", "direction"],
      _sum: { amount: true },
    }),
    prisma.user.findMany({ select: { id: true, fullName: true, email: true } }),
  ]);

  const userLabelById = new Map(users.map((u) => [u.id, `${u.fullName} (${u.email})`]));

  const netByAccountAsset = new Map<string, number>();
  for (const row of ledgerSums) {
    const key = `${row.accountId}:${row.assetId}`;
    const sum = Number(row._sum.amount ?? 0);
    const delta = row.direction === "CREDIT" ? sum : -sum;
    netByAccountAsset.set(key, (netByAccountAsset.get(key) ?? 0) + delta);
  }

  const discrepancies: BalanceDiscrepancy[] = [];
  for (const balance of balances) {
    const key = `${balance.userId}:${balance.assetId}`;
    const ledgerAmount = netByAccountAsset.get(key) ?? 0;
    const balanceAmount = Number(balance.balance);
    const difference = balanceAmount - ledgerAmount;
    // Decimal(24,8) round-tripping through Number can leave a sub-satoshi
    // artifact — 1e-8 is the smallest unit this schema can even represent.
    if (Math.abs(difference) > 1e-8) {
      discrepancies.push({
        accountId: balance.userId,
        accountLabel: userLabelById.get(balance.userId) ?? balance.userId,
        assetSymbol: balance.asset.symbol,
        balanceAmount,
        ledgerAmount,
        difference,
      });
    }
  }
  return discrepancies;
}

export interface VaultReserveSummary {
  assetSymbol: string;
  liabilities: number;
  reserves: number;
  solvencyRatioPct: number | null;
  deficit: boolean;
}

/**
 * Per-asset solvency comparison for the Proof-of-Reserve dashboard:
 * liabilities are what the platform owes clients (sum of UserBalance),
 * reserves are what admins have recorded the platform actually holding in
 * active custody vaults (sum of VaultReserve). A null ratio means there
 * are no liabilities to divide by yet.
 */
export async function computeReserveSummary(): Promise<VaultReserveSummary[]> {
  const [balances, reserves] = await Promise.all([
    prisma.userBalance.findMany({ include: { asset: true } }),
    prisma.vaultReserve.findMany({
      where: { vault: { isActive: true } },
      include: { asset: true },
    }),
  ]);

  const liabilitiesBySymbol = new Map<string, number>();
  for (const b of balances) {
    const symbol = b.asset.symbol;
    liabilitiesBySymbol.set(symbol, (liabilitiesBySymbol.get(symbol) ?? 0) + Number(b.balance));
  }

  const reservesBySymbol = new Map<string, number>();
  for (const r of reserves) {
    const symbol = r.asset.symbol;
    reservesBySymbol.set(symbol, (reservesBySymbol.get(symbol) ?? 0) + Number(r.balance));
  }

  const allSymbols = new Set([...liabilitiesBySymbol.keys(), ...reservesBySymbol.keys()]);
  const summary: VaultReserveSummary[] = [];
  for (const symbol of allSymbols) {
    const liabilities = liabilitiesBySymbol.get(symbol) ?? 0;
    const reserveAmount = reservesBySymbol.get(symbol) ?? 0;
    const solvencyRatioPct = liabilities > 0 ? (reserveAmount / liabilities) * 100 : null;
    summary.push({
      assetSymbol: symbol,
      liabilities,
      reserves: reserveAmount,
      solvencyRatioPct,
      deficit: liabilities > 0 && reserveAmount < liabilities,
    });
  }
  return summary.sort((a, b) => a.assetSymbol.localeCompare(b.assetSymbol));
}
