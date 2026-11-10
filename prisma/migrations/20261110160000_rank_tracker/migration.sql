-- Rank tracker: tracked keywords per project, their Google checks (DataForSEO SERP) and per-project tracker state.
-- CreateTable
CREATE TABLE "public"."TrackedKeyword" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locationId" TEXT NOT NULL DEFAULT 'in',
    "device" TEXT NOT NULL DEFAULT 'mobile',
    "language" TEXT NOT NULL DEFAULT 'en',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastPosition" INTEGER,
    "bestPosition" INTEGER,
    "lastUrl" TEXT,
    "lastFeatures" JSONB,
    "lastCompetitors" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RankCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trackedKeywordId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "position" INTEGER,
    "url" TEXT,
    "serpFeatures" JSONB,
    "competitors" JSONB,
    "trigger" TEXT NOT NULL DEFAULT 'schedule',

    CONSTRAINT "RankCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RankTrackerState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "message" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastManualCheckAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankTrackerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedKeyword_projectId_keyword_locationId_device_key" ON "public"."TrackedKeyword"("projectId", "keyword", "locationId", "device");

-- CreateIndex
CREATE INDEX "TrackedKeyword_organizationId_projectId_idx" ON "public"."TrackedKeyword"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "TrackedKeyword_projectId_active_lastCheckedAt_idx" ON "public"."TrackedKeyword"("projectId", "active", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "RankCheck_trackedKeywordId_checkedAt_idx" ON "public"."RankCheck"("trackedKeywordId", "checkedAt");

-- CreateIndex
CREATE INDEX "RankCheck_organizationId_checkedAt_idx" ON "public"."RankCheck"("organizationId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RankTrackerState_projectId_key" ON "public"."RankTrackerState"("projectId");

-- CreateIndex
CREATE INDEX "RankTrackerState_organizationId_idx" ON "public"."RankTrackerState"("organizationId");

-- AddForeignKey
ALTER TABLE "public"."TrackedKeyword" ADD CONSTRAINT "TrackedKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RankCheck" ADD CONSTRAINT "RankCheck_trackedKeywordId_fkey" FOREIGN KEY ("trackedKeywordId") REFERENCES "public"."TrackedKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RankTrackerState" ADD CONSTRAINT "RankTrackerState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
