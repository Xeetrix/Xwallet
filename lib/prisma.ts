import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Vercel's Supabase/Postgres integrations don't always populate DATABASE_URL
// directly — they commonly expose POSTGRES_PRISMA_URL (pooled, pgbouncer) or
// POSTGRES_URL instead. Fall back across the common names so the client
// still connects regardless of which one was actually set.
const databaseUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
