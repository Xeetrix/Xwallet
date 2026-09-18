-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER_SENT';
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER_RECEIVED';
ALTER TYPE "TransactionType" ADD VALUE 'SWAP_DEBIT';
ALTER TYPE "TransactionType" ADD VALUE 'SWAP_CREDIT';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "counterpartyEmail" TEXT,
ADD COLUMN     "feeAmount" DECIMAL(24,8);
