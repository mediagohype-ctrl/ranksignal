-- Remove rows orphaned before these relations existed, so the new foreign keys can be created.
DELETE FROM "public"."ReportSnapshot" WHERE "projectId" NOT IN (SELECT "id" FROM "public"."Project");
DELETE FROM "public"."Task" WHERE "projectId" NOT IN (SELECT "id" FROM "public"."Project");
DELETE FROM "public"."MonthlyReport" WHERE "projectId" NOT IN (SELECT "id" FROM "public"."Project");
DELETE FROM "public"."AdminNote" WHERE "organizationId" NOT IN (SELECT "id" FROM "public"."Organization");

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "branding" JSONB;

-- AlterTable
ALTER TABLE "public"."ReportSnapshot" ADD COLUMN     "report" JSONB;

-- CreateTable
CREATE TABLE "public"."OffsiteItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "napConsistent" BOOLEAN,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "taskId" TEXT,
    "notes" TEXT,
    "liveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffsiteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MetricDaily" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT 'total',
    "key" TEXT NOT NULL DEFAULT '',
    "clicks" INTEGER,
    "impressions" INTEGER,
    "ctr" DOUBLE PRECISION,
    "position" DOUBLE PRECISION,
    "sessions" INTEGER,
    "conversions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OffsiteItem_organizationId_projectId_status_idx" ON "public"."OffsiteItem"("organizationId", "projectId", "status");

-- CreateIndex
CREATE INDEX "MetricDaily_organizationId_projectId_source_date_idx" ON "public"."MetricDaily"("organizationId", "projectId", "source", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDaily_projectId_source_date_dimension_key_key" ON "public"."MetricDaily"("projectId", "source", "date", "dimension", "key");

-- CreateIndex
CREATE INDEX "Observation_visibilityRunId_createdAt_idx" ON "public"."Observation"("visibilityRunId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MonthlyReport" ADD CONSTRAINT "MonthlyReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminNote" ADD CONSTRAINT "AdminNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffsiteItem" ADD CONSTRAINT "OffsiteItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MetricDaily" ADD CONSTRAINT "MetricDaily_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

