-- CreateTable
CREATE TABLE "Vulnerability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vulId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bounty" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitter" TEXT NOT NULL,
    "projectAddress" TEXT NOT NULL,
    "projectName" TEXT,
    "challengeBond" REAL,
    "challengeReason" TEXT,
    "challengeAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arbitratedAt" DATETIME,
    "settledAt" DATETIME,
    "totalConfidence" REAL
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vulId" TEXT NOT NULL,
    "subVulId" TEXT NOT NULL,
    "submitter" TEXT NOT NULL,
    "submitterName" TEXT,
    "walletAddress" TEXT NOT NULL,
    "agentId" TEXT,
    "confidence" REAL,
    "qualityScore" REAL NOT NULL DEFAULT 0,
    "pocQuality" INTEGER,
    "fixQuality" INTEGER,
    "ranking" INTEGER NOT NULL DEFAULT 0,
    "clusterId" TEXT,
    "calibratedReward" REAL,
    "baseReward" REAL,
    "calibrationMult" REAL,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,
    "rewardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_vulId_fkey" FOREIGN KEY ("vulId") REFERENCES "Vulnerability" ("vulId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardDistribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vulId" TEXT NOT NULL,
    "totalBounty" REAL NOT NULL DEFAULT 0,
    "distributions" TEXT NOT NULL DEFAULT '[]',
    "totalDistributed" REAL NOT NULL DEFAULT 0,
    "platformFee" REAL,
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardDistribution_vulId_fkey" FOREIGN KEY ("vulId") REFERENCES "Vulnerability" ("vulId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auditor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "reputation" REAL NOT NULL DEFAULT 0,
    "level" TEXT NOT NULL DEFAULT 'Rookie',
    "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
    "validSubmissions" INTEGER NOT NULL DEFAULT 0,
    "invalidSubmissions" INTEGER NOT NULL DEFAULT 0,
    "totalBounty" REAL NOT NULL DEFAULT 0,
    "maxSubmissions" INTEGER NOT NULL DEFAULT 5,
    "lastActive" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AIAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalReports" INTEGER NOT NULL DEFAULT 0,
    "correctPredictions" INTEGER NOT NULL DEFAULT 0,
    "calibration" REAL NOT NULL DEFAULT 0,
    "avgConfidence" REAL NOT NULL DEFAULT 0,
    "avgActualAccuracy" REAL NOT NULL DEFAULT 0,
    "reputation" REAL NOT NULL DEFAULT 0,
    "multiplier" REAL NOT NULL DEFAULT 100,
    "lastCalibration" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Juror" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "name" TEXT,
    "stake" REAL NOT NULL DEFAULT 0,
    "reputation" REAL NOT NULL DEFAULT 100,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "correctVotes" INTEGER NOT NULL DEFAULT 0,
    "incorrectVotes" INTEGER NOT NULL DEFAULT 0,
    "slashedAmount" REAL NOT NULL DEFAULT 0,
    "totalRewards" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastActive" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Arbitration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vulId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "challengeReason" TEXT,
    "challengeBond" REAL,
    "selectedJurors" TEXT,
    "validVotes" INTEGER NOT NULL DEFAULT 0,
    "invalidVotes" INTEGER NOT NULL DEFAULT 0,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "finalResult" TEXT,
    "arbitrator" TEXT,
    "deadline" DATETIME,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "vulnerabilityId" TEXT,
    "auditorId" TEXT,
    "agentId" TEXT,
    "jurorId" TEXT,
    "details" TEXT,
    "operator" TEXT,
    "operatorType" TEXT,
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "Vulnerability" ("vulId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "Auditor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "retryCount" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Vulnerability_vulId_key" ON "Vulnerability"("vulId");

-- CreateIndex
CREATE INDEX "Vulnerability_status_idx" ON "Vulnerability"("status");

-- CreateIndex
CREATE INDEX "Vulnerability_projectAddress_idx" ON "Vulnerability"("projectAddress");

-- CreateIndex
CREATE INDEX "Vulnerability_createdAt_idx" ON "Vulnerability"("createdAt");

-- CreateIndex
CREATE INDEX "Submission_vulId_idx" ON "Submission"("vulId");

-- CreateIndex
CREATE INDEX "Submission_submitter_idx" ON "Submission"("submitter");

-- CreateIndex
CREATE INDEX "Submission_ranking_idx" ON "Submission"("ranking");

-- CreateIndex
CREATE INDEX "RewardDistribution_vulId_idx" ON "RewardDistribution"("vulId");

-- CreateIndex
CREATE UNIQUE INDEX "Auditor_walletAddress_key" ON "Auditor"("walletAddress");

-- CreateIndex
CREATE INDEX "Auditor_reputation_idx" ON "Auditor"("reputation");

-- CreateIndex
CREATE INDEX "Auditor_level_idx" ON "Auditor"("level");

-- CreateIndex
CREATE UNIQUE INDEX "AIAgent_agentId_key" ON "AIAgent"("agentId");

-- CreateIndex
CREATE INDEX "AIAgent_calibration_idx" ON "AIAgent"("calibration");

-- CreateIndex
CREATE INDEX "AIAgent_reputation_idx" ON "AIAgent"("reputation");

-- CreateIndex
CREATE UNIQUE INDEX "Juror_walletAddress_key" ON "Juror"("walletAddress");

-- CreateIndex
CREATE INDEX "Juror_reputation_idx" ON "Juror"("reputation");

-- CreateIndex
CREATE INDEX "Juror_active_idx" ON "Juror"("active");

-- CreateIndex
CREATE INDEX "Arbitration_vulId_idx" ON "Arbitration"("vulId");

-- CreateIndex
CREATE INDEX "Arbitration_status_idx" ON "Arbitration"("status");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookConfig_event_idx" ON "WebhookConfig"("event");
