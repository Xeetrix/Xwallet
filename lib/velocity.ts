import { prisma } from "@/lib/prisma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const MIN_SAMPLE_SIZE = 5;
const STDDEV_MULTIPLIER = 3;
const RAPID_WITHDRAWAL_THRESHOLD = 2;

export interface VelocityCheckResult {
  flagged: boolean;
  reason: string | null;
}

/**
 * Advisory-only transaction-monitoring check — never blocks a transfer or
 * withdrawal, only marks it for admin review. Two independent signals:
 *
 * 1. The new amount exceeds mean + 3·stddev of this user's own approved
 *    history for the same asset+type over the trailing 30 days (skipped
 *    entirely below MIN_SAMPLE_SIZE prior transactions — not enough data
 *    for a meaningful standard deviation).
 * 2. For withdrawals only: 2 or more withdrawals already submitted by this
 *    user in the trailing 10 minutes (rapid successive withdrawals, a
 *    common account-takeover pattern of draining funds before the
 *    victim notices).
 */
export async function checkVelocityAnomaly(params: {
  userId: string;
  assetId: string;
  amount: number;
  type: "TRANSFER_SENT" | "WITHDRAWAL";
}): Promise<VelocityCheckResult> {
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
  const tenMinutesAgo = new Date(Date.now() - TEN_MINUTES_MS);

  const [history, recentWithdrawalCount] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId: params.userId,
        assetId: params.assetId,
        type: params.type,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { amount: true },
    }),
    params.type === "WITHDRAWAL"
      ? prisma.transaction.count({
          where: { userId: params.userId, type: "WITHDRAWAL", createdAt: { gte: tenMinutesAgo } },
        })
      : Promise.resolve(0),
  ]);

  const reasons: string[] = [];

  if (params.type === "WITHDRAWAL" && recentWithdrawalCount >= RAPID_WITHDRAWAL_THRESHOLD) {
    reasons.push(`${recentWithdrawalCount} withdrawals already submitted by this account in the last 10 minutes`);
  }

  if (history.length >= MIN_SAMPLE_SIZE) {
    const amounts = history.map((h) => Number(h.amount));
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + (a - mean) ** 2, 0) / amounts.length;
    const stddev = Math.sqrt(variance);
    const threshold = mean + STDDEV_MULTIPLIER * stddev;

    if (stddev > 0 && params.amount > threshold) {
      reasons.push(
        `Amount ${params.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} exceeds 3σ of this account's 30-day average (mean ${mean.toFixed(8)}, σ ${stddev.toFixed(8)})`
      );
    }
  }

  return { flagged: reasons.length > 0, reason: reasons.length > 0 ? reasons.join("; ") : null };
}
