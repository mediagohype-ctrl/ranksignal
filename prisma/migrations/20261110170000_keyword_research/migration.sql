-- Keyword research + SERP checker (DataForSEO): shared result cache (public Google data) and per-organization history.
-- CreateTable
CREATE TABLE "public"."ResearchCache" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchSearch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "device" TEXT,
    "mode" TEXT,
    "requestKey" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchCache_requestKey_key" ON "public"."ResearchCache"("requestKey");

-- CreateIndex
CREATE INDEX "ResearchCache_kind_fetchedAt_idx" ON "public"."ResearchCache"("kind", "fetchedAt");

-- CreateIndex
CREATE INDEX "ResearchSearch_organizationId_projectId_kind_createdAt_idx" ON "public"."ResearchSearch"("organizationId", "projectId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."ResearchSearch" ADD CONSTRAINT "ResearchSearch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchSearch" ADD CONSTRAINT "ResearchSearch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
