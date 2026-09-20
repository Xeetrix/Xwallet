-- CreateEnum
CREATE TYPE "KycTier" AS ENUM ('BASIC', 'VERIFIED', 'INSTITUTIONAL');

-- CreateEnum
CREATE TYPE "UnattributedDepositStatus" AS ENUM ('PENDING', 'ASSIGNED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyLimitUsd" DECIMAL(24,2),
ADD COLUMN     "kycTier" "KycTier" NOT NULL DEFAULT 'BASIC',
ADD COLUMN     "monthlyLimitUsd" DECIMAL(24,2),
ADD COLUMN     "totpBackupCodesHash" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnattributedDeposit" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "networkName" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" "UnattributedDepositStatus" NOT NULL DEFAULT 'PENDING',
    "assignedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnattributedDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UnattributedDeposit_txHash_key" ON "UnattributedDeposit"("txHash");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnattributedDeposit" ADD CONSTRAINT "UnattributedDeposit_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnattributedDeposit" ADD CONSTRAINT "UnattributedDeposit_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

