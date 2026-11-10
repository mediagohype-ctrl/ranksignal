-- Backlink checker + link gap (DataForSEO Backlinks API): monitor state, per-refresh snapshots, link-gap lookups.
-- CreateTable
CREATE TABLE "public"."BacklinkMonitor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "lastRefreshAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacklinkMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BacklinkSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "backlinks" INTEGER,
    "referringDomains" INTEGER,
    "rank" INTEGER,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacklinkSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LinkGapReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "competitors" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "totalCount" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkGapReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BacklinkMonitor_projectId_key" ON "public"."BacklinkMonitor"("projectId");

-- CreateIndex
CREATE INDEX "BacklinkMonitor_organizationId_idx" ON "public"."BacklinkMonitor"("organizationId");

-- CreateIndex
CREATE INDEX "BacklinkSnapshot_organizationId_projectId_createdAt_idx" ON "public"."BacklinkSnapshot"("organizationId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "LinkGapReport_organizationId_projectId_createdAt_idx" ON "public"."LinkGapReport"("organizationId", "projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."BacklinkMonitor" ADD CONSTRAINT "BacklinkMonitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BacklinkSnapshot" ADD CONSTRAINT "BacklinkSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinkGapReport" ADD CONSTRAINT "LinkGapReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
