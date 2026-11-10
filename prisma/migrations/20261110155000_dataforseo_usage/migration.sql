-- Shared usage ledger for the paid-data features (DataForSEO): plan allowances and cost tracking.
-- CreateTable
CREATE TABLE "public"."DataForSeoUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "feature" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataForSeoUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataForSeoUsage_organizationId_feature_createdAt_idx" ON "public"."DataForSeoUsage"("organizationId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "DataForSeoUsage_createdAt_idx" ON "public"."DataForSeoUsage"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."DataForSeoUsage" ADD CONSTRAINT "DataForSeoUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
