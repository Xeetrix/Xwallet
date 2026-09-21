-- One-time backfill: writes LedgerEntry rows for balance-affecting
-- Transactions that were approved before the double-entry ledger existed
-- (LedgerEntry didn't exist yet, so the prior code never wrote to it).
-- Without this, reconcileLedger() and the Proof-of-Reserve dashboard would
-- immediately flag every pre-existing client balance as a discrepancy on
-- deploy day, even though nothing is actually wrong. Guarded by NOT EXISTS
-- throughout, so this is a no-op anywhere a transaction already has ledger
-- entries (any environment where the ledger existed from the start).
--
-- Covers every balance-affecting Transaction type that had any APPROVED
-- rows in production at the time this migration was written: DEPOSIT,
-- MANUAL_CREDIT, MANUAL_DEBIT, and SWAP_DEBIT/SWAP_CREDIT pairs. It
-- deliberately does not attempt WITHDRAWAL, TRANSFER_SENT, or
-- TRANSFER_RECEIVED backfill — no pre-existing approved rows of those
-- types existed anywhere this migration has been written against, so
-- there is nothing to reconstruct from; reconcileLedger() would surface
-- any such gap for manual admin follow-up if one ever turns up elsewhere.

-- DEPOSIT / MANUAL_CREDIT: client gained the asset, the reserve supplied it.
CREATE TEMP TABLE _ledger_backfill_credits AS
SELECT t.id, t."userId", t."assetId", t.amount, t."createdAt"
FROM "Transaction" t
WHERE t.type IN ('DEPOSIT', 'MANUAL_CREDIT') AND t.status = 'APPROVED'
  AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" le WHERE le."transactionId" = t.id);

INSERT INTO "LedgerEntry" ("id", "transactionId", "accountId", "assetId", "direction", "amount", "createdAt")
SELECT gen_random_uuid()::text, id, "userId", "assetId", 'CREDIT'::"LedgerDirection", amount, "createdAt" FROM _ledger_backfill_credits
UNION ALL
SELECT gen_random_uuid()::text, id, 'SYSTEM_RESERVE', "assetId", 'DEBIT'::"LedgerDirection", amount, "createdAt" FROM _ledger_backfill_credits;

-- MANUAL_DEBIT: client gave up the asset, back into the reserve.
CREATE TEMP TABLE _ledger_backfill_debits AS
SELECT t.id, t."userId", t."assetId", t.amount, t."createdAt"
FROM "Transaction" t
WHERE t.type = 'MANUAL_DEBIT' AND t.status = 'APPROVED'
  AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" le WHERE le."transactionId" = t.id);

INSERT INTO "LedgerEntry" ("id", "transactionId", "accountId", "assetId", "direction", "amount", "createdAt")
SELECT gen_random_uuid()::text, id, "userId", "assetId", 'DEBIT'::"LedgerDirection", amount, "createdAt" FROM _ledger_backfill_debits
UNION ALL
SELECT gen_random_uuid()::text, id, 'SYSTEM_RESERVE', "assetId", 'CREDIT'::"LedgerDirection", amount, "createdAt" FROM _ledger_backfill_debits;

-- SWAP_DEBIT/SWAP_CREDIT pairs: modeled the same way the live convertAsset()
-- code models a fresh conversion — client sells fromAsset to the reserve
-- and buys toAsset from it, with the network fee leaving separately into
-- the fee-collector account. Paired by matching each SWAP_DEBIT to the
-- next SWAP_CREDIT for the same user, mirroring how the two rows are
-- always created back-to-back by convertAsset() in a single transaction.
CREATE TEMP TABLE _ledger_backfill_swaps AS
SELECT
  d.id AS debit_id, d."userId", d."assetId" AS from_asset_id, d.amount AS from_amount,
  d."feeAssetId" AS fee_asset_id, d."feeAmount" AS fee_amount, d."createdAt",
  c."assetId" AS to_asset_id, c.amount AS to_amount
FROM "Transaction" d
JOIN LATERAL (
  SELECT c."assetId", c.amount
  FROM "Transaction" c
  WHERE c."userId" = d."userId" AND c.type = 'SWAP_CREDIT' AND c.status = 'APPROVED'
    AND c."createdAt" >= d."createdAt"
  ORDER BY c."createdAt" ASC
  LIMIT 1
) c ON true
WHERE d.type = 'SWAP_DEBIT' AND d.status = 'APPROVED'
  AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" le WHERE le."transactionId" = d.id);

INSERT INTO "LedgerEntry" ("id", "transactionId", "accountId", "assetId", "direction", "amount", "createdAt")
SELECT gen_random_uuid()::text, debit_id, "userId", from_asset_id, 'DEBIT'::"LedgerDirection", from_amount, "createdAt" FROM _ledger_backfill_swaps
UNION ALL
SELECT gen_random_uuid()::text, debit_id, 'SYSTEM_RESERVE', from_asset_id, 'CREDIT'::"LedgerDirection", from_amount, "createdAt" FROM _ledger_backfill_swaps
UNION ALL
SELECT gen_random_uuid()::text, debit_id, 'SYSTEM_RESERVE', to_asset_id, 'DEBIT'::"LedgerDirection", to_amount, "createdAt" FROM _ledger_backfill_swaps
UNION ALL
SELECT gen_random_uuid()::text, debit_id, "userId", to_asset_id, 'CREDIT'::"LedgerDirection", to_amount, "createdAt" FROM _ledger_backfill_swaps
UNION ALL
SELECT gen_random_uuid()::text, debit_id, "userId", fee_asset_id, 'DEBIT'::"LedgerDirection", fee_amount, "createdAt" FROM _ledger_backfill_swaps WHERE fee_asset_id IS NOT NULL AND fee_amount IS NOT NULL
UNION ALL
SELECT gen_random_uuid()::text, debit_id, 'GAS_FEE_COLLECTOR', fee_asset_id, 'CREDIT'::"LedgerDirection", fee_amount, "createdAt" FROM _ledger_backfill_swaps WHERE fee_asset_id IS NOT NULL AND fee_amount IS NOT NULL;
