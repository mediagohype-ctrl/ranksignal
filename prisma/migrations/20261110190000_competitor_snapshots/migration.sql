-- Competitors page (DataForSEO Labs): cached traffic estimates, keyword gaps, domain comparisons, batch traffic and
-- suggested competitors, so viewing the page never re-bills. One row per (project, kind, key).
-- CreateTable
CREATE TABLE "public"."CompetitorSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locationId" TEXT NOT NULL DEFAULT 'in',
    "language" TEXT NOT NULL DEFAULT 'en',
    "data" JSONB NOT NULL,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSnapshot_projectId_kind_key_key" ON "public"."CompetitorSnapshot"("projectId", "kind", "key");

-- CreateIndex
CREATE INDEX "CompetitorSnapshot_organizationId_projectId_kind_updatedAt_idx" ON "public"."CompetitorSnapshot"("organizationId", "projectId", "kind", "updatedAt");

-- AddForeignKey
ALTER TABLE "public"."CompetitorSnapshot" ADD CONSTRAINT "CompetitorSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompetitorSnapshot" ADD CONSTRAINT "CompetitorSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
