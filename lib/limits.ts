import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchUsdPrices } from "@/lib/pricing";

const LIMITED_TYPES = ["TRANSFER_SENT", "WITHDRAWAL"] as const;
const LIMITED_STATUSES = ["PENDING", "APPROVED"] as const;

/**
 * Approximates a user's USD volume moved today/this month by re-pricing
 * every relevant past transaction at CURRENT spot price — no historical
 * price snapshot is captured per transaction today. This is a deliberate
 * simplification: accurate enough for a soft compliance guard on
 * relatively stable assets, but can slightly over/under-count for an
 * asset that moved sharply since the original transaction. Precise
 * historical valuation would require storing a USD snapshot on every
 * Transaction row, which is out of scope for this pass.
 *
 * Called before any debit happens, so a rejection here never leaves
 * partial state to unwind.
 */
export async function checkTransactionLimits(params: {
  userId: string;
  assetSymbol: string;
  amount: number;
  dailyLimitUsd: Prisma.Decimal | null;
  monthlyLimitUsd: Prisma.Decimal | null;
}): Promise<{ error: string | null }> {
  const { userId, assetSymbol, amount, dailyLimitUsd, monthlyLimitUsd } = params;
  if (!dailyLimitUsd && !monthlyLimitUsd) return { error: null };

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyTx, monthlyTx] = await Promise.all([
    dailyLimitUsd
      ? prisma.transaction.findMany({
          where: {
            userId,
            type: { in: [...LIMITED_TYPES] },
            status: { in: [...LIMITED_STATUSES] },
            createdAt: { gte: startOfDay },
          },
          include: { asset: true },
        })
      : Promise.resolve([]),
    monthlyLimitUsd
      ? prisma.transaction.findMany({
          where: {
            userId,
            type: { in: [...LIMITED_TYPES] },
            status: { in: [...LIMITED_STATUSES] },
            createdAt: { gte: startOfMonth },
          },
          include: { asset: true },
        })
      : Promise.resolve([]),
  ]);

  const allSymbols = Array.from(
    new Set([assetSymbol, ...dailyTx.map((t) => t.asset.symbol), ...monthlyTx.map((t) => t.asset.symbol)])
  );
  const prices = await fetchUsdPrices(allSymbols);
  const priceOf = (symbol: string) => prices[symbol.toUpperCase()] ?? 0;

  const amountUsd = amount * priceOf(assetSymbol);

  if (dailyLimitUsd) {
    const movedTodayUsd = dailyTx.reduce((sum, t) => sum + Number(t.amount) * priceOf(t.asset.symbol), 0);
    if (movedTodayUsd + amountUsd > Number(dailyLimitUsd)) {
      return {
        error: `This exceeds your daily transaction limit of $${Number(dailyLimitUsd).toLocaleString()}. Contact your relationship manager to raise it.`,
      };
    }
  }

  if (monthlyLimitUsd) {
    const movedMonthUsd = monthlyTx.reduce((sum, t) => sum + Number(t.amount) * priceOf(t.asset.symbol), 0);
    if (movedMonthUsd + amountUsd > Number(monthlyLimitUsd)) {
      return {
        error: `This exceeds your monthly transaction limit of $${Number(monthlyLimitUsd).toLocaleString()}. Contact your relationship manager to raise it.`,
      };
    }
  }

  return { error: null };
}
