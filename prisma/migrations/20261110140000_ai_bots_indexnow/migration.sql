-- AI bot visit analytics (daily aggregates from server logs, never raw lines/IPs) and IndexNow for customer sites.
-- CreateTable
CREATE TABLE "public"."AiBotDaily" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "bot" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "verifiedHits" INTEGER NOT NULL DEFAULT 0,
    "unverifiedHits" INTEGER NOT NULL DEFAULT 0,
    "statusCounts" JSONB NOT NULL,
    "topPaths" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiBotDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiBotLogImport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "sha256" TEXT,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "linesTotal" INTEGER NOT NULL DEFAULT 0,
    "linesParsed" INTEGER NOT NULL DEFAULT 0,
    "botHits" INTEGER NOT NULL DEFAULT 0,
    "firstDate" TEXT,
    "lastDate" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiBotLogImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiBotIngestKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiBotIngestKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IndexNowSite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "onFixPublished" BOOLEAN NOT NULL DEFAULT true,
    "onCrawlChanges" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "lastCheckError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexNowSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IndexNowSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "urls" JSONB NOT NULL,
    "urlCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "httpStatus" INTEGER,
    "message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndexNowSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiBotDaily_organizationId_projectId_date_idx" ON "public"."AiBotDaily"("organizationId", "projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AiBotDaily_projectId_date_bot_key" ON "public"."AiBotDaily"("projectId", "date", "bot");

-- CreateIndex
CREATE INDEX "AiBotLogImport_organizationId_projectId_createdAt_idx" ON "public"."AiBotLogImport"("organizationId", "projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiBotLogImport_projectId_sha256_key" ON "public"."AiBotLogImport"("projectId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "AiBotIngestKey_projectId_key" ON "public"."AiBotIngestKey"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AiBotIngestKey_tokenHash_key" ON "public"."AiBotIngestKey"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "IndexNowSite_projectId_key" ON "public"."IndexNowSite"("projectId");

-- CreateIndex
CREATE INDEX "IndexNowSubmission_organizationId_projectId_createdAt_idx" ON "public"."IndexNowSubmission"("organizationId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "IndexNowSubmission_host_status_sentAt_idx" ON "public"."IndexNowSubmission"("host", "status", "sentAt");

-- AddForeignKey
ALTER TABLE "public"."AiBotDaily" ADD CONSTRAINT "AiBotDaily_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiBotLogImport" ADD CONSTRAINT "AiBotLogImport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiBotIngestKey" ADD CONSTRAINT "AiBotIngestKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IndexNowSite" ADD CONSTRAINT "IndexNowSite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IndexNowSubmission" ADD CONSTRAINT "IndexNowSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
