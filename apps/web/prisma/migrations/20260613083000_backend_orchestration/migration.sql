-- CreateTable
CREATE TABLE "CantonContract" (
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
);

-- CreateTable
CREATE TABLE "PolicyCache" (
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
);

-- CreateTable
CREATE TABLE "DemoParty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "cantonPartyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "CantonContract_contractId_key" ON "CantonContract"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "DemoParty_role_key" ON "DemoParty"("role");
