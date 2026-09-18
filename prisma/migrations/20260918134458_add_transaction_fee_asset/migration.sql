-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "feeAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_feeAssetId_fkey" FOREIGN KEY ("feeAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
