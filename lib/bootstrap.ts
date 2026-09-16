import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

// Guards against re-querying the database on every request within the same
// warm serverless instance. Resets naturally on the next cold start, which
// is exactly when we'd want to re-check anyway.
let checked = false;

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
