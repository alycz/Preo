import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  demoDatabaseReady?: Promise<void>;
};

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

function usesDemoTmpSqlite() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  return process.env.DEMO_MODE === "true" && (databaseUrl.startsWith("file:/tmp/") || databaseUrl.startsWith("file:///tmp/"));
}

async function ensureDemoDatabase() {
  if (!usesDemoTmpSqlite()) {
    return;
  }
  globalForPrisma.demoDatabaseReady ??= initializeDemoDatabase().catch((error) => {
    globalForPrisma.demoDatabaseReady = undefined;
    throw error;
  });
  await globalForPrisma.demoDatabaseReady;
}

async function initializeDemoDatabase() {
  await prismaClient.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "dynamicUserId" TEXT NOT NULL,
      "email" TEXT,
      "primaryWalletAddress" TEXT,
      "agentWalletAddress" TEXT,
      "cantonPartyId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prismaClient.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_dynamicUserId_key" ON "User"("dynamicUserId")`);
  await prismaClient.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_cantonPartyId_key" ON "User"("cantonPartyId")`);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FundingIntent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "checkoutId" TEXT,
      "transactionId" TEXT,
      "amount" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "chainId" INTEGER,
      "tokenAddress" TEXT,
      "destinationAddress" TEXT,
      "externalRef" TEXT,
      "logIndex" INTEGER,
      "status" TEXT NOT NULL,
      "settlementTxHash" TEXT,
      "cantonCreditContractId" TEXT,
      "metadata" JSONB,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "FundingIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await prismaClient.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "FundingIntent_transactionId_key" ON "FundingIntent"("transactionId")`);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EvmEvent" (
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
    )
  `);
  await prismaClient.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EvmEvent_chainId_txHash_logIndex_key" ON "EvmEvent"("chainId", "txHash", "logIndex")`);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WebhookEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "eventId" TEXT,
      "payload" JSONB NOT NULL,
      "signatureValid" BOOLEAN NOT NULL,
      "processedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AgentAction" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "actionType" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "dynamicWalletAddress" TEXT,
      "evmTxHash" TEXT,
      "cantonContractId" TEXT,
      "pendingActionId" TEXT,
      "amount" TEXT,
      "asset" TEXT,
      "error" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "AgentAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CantonContract" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "contractId" TEXT NOT NULL,
      "templateId" TEXT NOT NULL,
      "partyId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "archivedAt" DATETIME,
      CONSTRAINT "CantonContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
  await prismaClient.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CantonContract_contractId_key" ON "CantonContract"("contractId")`);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PolicyCache" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "cantonContractId" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "policyName" TEXT NOT NULL,
      "categories" JSONB NOT NULL,
      "approvalRules" JSONB NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PolicyCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DemoParty" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "role" TEXT NOT NULL,
      "cantonPartyId" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prismaClient.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DemoParty_role_key" ON "DemoParty"("role")`);
}

export const prisma = prismaClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        await ensureDemoDatabase();
        return query(args);
      }
    }
  }
});
