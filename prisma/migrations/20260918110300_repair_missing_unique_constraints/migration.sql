-- Idempotent repair migration.
--
-- Production hit Postgres error 42P10 ("there is no unique or exclusion
-- constraint matching the ON CONFLICT specification") on
-- prisma.networkAddress.upsert(). Root cause: scripts/build.sh's P3005
-- auto-baseline runs `prisma migrate resolve --applied` whenever it finds
-- tables that already exist outside Prisma Migrate, which marks
-- 20250101000000_init as applied WITHOUT verifying the live schema
-- actually matches that migration's SQL. Production's tables were missing
-- the NetworkAddress(assetId, networkName) unique index init.sql was
-- supposed to create, and — since a baselined migration never re-runs —
-- that gap was permanent until now.
--
-- Every statement below is a no-op wherever the constraint already
-- exists, so this is safe to run against any database, drifted or not.

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Asset_symbol_key" ON "Asset"("symbol");
CREATE UNIQUE INDEX IF NOT EXISTS "NetworkAddress_assetId_networkName_key" ON "NetworkAddress"("assetId", "networkName");
CREATE UNIQUE INDEX IF NOT EXISTS "UserBalance_userId_assetId_key" ON "UserBalance"("userId", "assetId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NetworkAddress_assetId_fkey') THEN
    ALTER TABLE "NetworkAddress" ADD CONSTRAINT "NetworkAddress_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBalance_userId_fkey') THEN
    ALTER TABLE "UserBalance" ADD CONSTRAINT "UserBalance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBalance_assetId_fkey') THEN
    ALTER TABLE "UserBalance" ADD CONSTRAINT "UserBalance_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_userId_fkey') THEN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_assetId_fkey') THEN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
