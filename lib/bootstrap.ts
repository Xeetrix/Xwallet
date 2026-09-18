import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

// Guards against re-querying the database on every request within the same
// warm serverless instance. Resets naturally on the next cold start, which
// is exactly when we'd want to re-check anyway.
let checked = false;
let assetsChecked = false;

// Every client is expected to be able to hold at least these — curated to
// match the pricing (lib/pricing.ts) and icon (cryptocurrency-icons) coverage
// already in place. Admins can still add more from the Assets console; this
// just guarantees the baseline exists without manual one-by-one entry.
const DEFAULT_ASSETS: { symbol: string; name: string }[] = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "TRX", name: "TRON" },
  { symbol: "ADA", name: "Cardano" },
];

/**
 * Self-healing admin bootstrap: if ADMIN_BOOTSTRAP_EMAIL/PASSWORD are set in
 * the environment and no ADMIN user exists yet, create one. No-ops entirely
 * if those env vars aren't configured, or once any admin already exists.
 * Safe to call on every request — never throws, even if the database is
 * unreachable or two cold starts race to create the same account.
 */
export async function ensureMasterAdmin(): Promise<void> {
  if (checked) return;

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

  try {
    const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin) {
      checked = true;
      return;
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.create({
      data: {
        fullName: "Master Admin",
        email,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    checked = true;
  } catch (error) {
    // Another cold start already created it concurrently — fine, ignore.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      checked = true;
      return;
    }
    // Database unreachable, migrations not applied yet, etc. Don't let a
    // bootstrap failure take down page rendering — just retry next request.
    console.error("ensureMasterAdmin failed:", error);
  }
}

/**
 * Self-healing default-asset bootstrap: makes sure the baseline asset list
 * (DEFAULT_ASSETS) exists, creating only whichever ones are missing. Safe to
 * call on every request — never throws, and never overwrites or duplicates
 * assets an admin already configured (existing rows, including ones with a
 * matching symbol but different name, are left untouched).
 */
export async function ensureDefaultAssets(): Promise<void> {
  if (assetsChecked) return;

  try {
    const existing = await prisma.asset.findMany({
      where: { symbol: { in: DEFAULT_ASSETS.map((a) => a.symbol) } },
      select: { symbol: true },
    });
    const existingSymbols = new Set(existing.map((a) => a.symbol));
    const missing = DEFAULT_ASSETS.filter((a) => !existingSymbols.has(a.symbol));

    if (missing.length > 0) {
      await prisma.asset.createMany({ data: missing, skipDuplicates: true });
    }
    assetsChecked = true;
  } catch (error) {
    console.error("ensureDefaultAssets failed:", error);
  }
}
