-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'QUEUED';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "multisigProposal" JSONB;

-- CreateTable
CREATE TABLE "CustodyVault" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "vaultAddress" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "signers" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultReserve" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "balance" DECIMAL(24,8) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultReserve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VaultReserve_vaultId_assetId_key" ON "VaultReserve"("vaultId", "assetId");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_assetId_idx" ON "LedgerEntry"("accountId", "assetId");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");

-- AddForeignKey
ALTER TABLE "VaultReserve" ADD CONSTRAINT "VaultReserve_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "CustodyVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultReserve" ADD CONSTRAINT "VaultReserve_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

