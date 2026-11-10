-- Audit depth: real page speed (Google PageSpeed Insights) and post-crawl probes (image sizes, redirecting links,
-- canonical targets, noindex pages listed in the sitemap). One AuditDepthRun per crawl; PageSpeedResult per page/strategy.
-- CreateTable
CREATE TABLE "public"."AuditDepthRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "psiPlanned" INTEGER NOT NULL DEFAULT 0,
    "psiDone" INTEGER NOT NULL DEFAULT 0,
    "probes" JSONB,
    "sitemapNoindex" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditDepthRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PageSpeedResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "performanceScore" INTEGER,
    "labLcpMs" INTEGER,
    "labCls" DOUBLE PRECISION,
    "labTbtMs" INTEGER,
    "labFcpMs" INTEGER,
    "fieldLcpMs" INTEGER,
    "fieldInpMs" INTEGER,
    "fieldCls" DOUBLE PRECISION,
    "fieldFcpMs" INTEGER,
    "fieldScope" TEXT,
    "error" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageSpeedResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditDepthRun_crawlRunId_key" ON "public"."AuditDepthRun"("crawlRunId");

-- CreateIndex
CREATE INDEX "AuditDepthRun_organizationId_projectId_createdAt_idx" ON "public"."AuditDepthRun"("organizationId", "projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PageSpeedResult_crawlRunId_url_strategy_key" ON "public"."PageSpeedResult"("crawlRunId", "url", "strategy");

-- CreateIndex
CREATE INDEX "PageSpeedResult_organizationId_projectId_createdAt_idx" ON "public"."PageSpeedResult"("organizationId", "projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."AuditDepthRun" ADD CONSTRAINT "AuditDepthRun_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "public"."CrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PageSpeedResult" ADD CONSTRAINT "PageSpeedResult_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "public"."CrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
