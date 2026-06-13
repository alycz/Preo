-- AlterTable
ALTER TABLE "FundingIntent" ADD COLUMN "chainId" INTEGER;
ALTER TABLE "FundingIntent" ADD COLUMN "tokenAddress" TEXT;
ALTER TABLE "FundingIntent" ADD COLUMN "destinationAddress" TEXT;
ALTER TABLE "FundingIntent" ADD COLUMN "externalRef" TEXT;
ALTER TABLE "FundingIntent" ADD COLUMN "logIndex" INTEGER;

-- CreateTable
CREATE TABLE "EvmEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "eventName" TEXT NOT NULL,
    "vaultAddress" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "preoUserIdHash" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" DATETIME,
    "cantonCreditContractId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvmEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EvmEvent_chainId_txHash_logIndex_key" ON "EvmEvent"("chainId", "txHash", "logIndex");
