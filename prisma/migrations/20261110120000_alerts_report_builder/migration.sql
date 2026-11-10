-- Alerts (per-project rules, history, 24h de-duplication, daily digest) and the client report builder (saved templates).
-- CreateTable
CREATE TABLE "public"."AlertSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlertEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "channels" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReportTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "intro" TEXT,
    "notes" TEXT,
    "range" JSONB,
    "isOrgDefault" BOOLEAN NOT NULL DEFAULT false,
    "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertSettings_projectId_key" ON "public"."AlertSettings"("projectId");

-- CreateIndex
CREATE INDEX "AlertSettings_organizationId_idx" ON "public"."AlertSettings"("organizationId");

-- CreateIndex
CREATE INDEX "AlertEvent_organizationId_projectId_createdAt_idx" ON "public"."AlertEvent"("organizationId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_projectId_rule_dedupeKey_createdAt_idx" ON "public"."AlertEvent"("projectId", "rule", "dedupeKey", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_status_createdAt_idx" ON "public"."AlertEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReportTemplate_organizationId_projectId_idx" ON "public"."ReportTemplate"("organizationId", "projectId");

-- AddForeignKey
ALTER TABLE "public"."AlertSettings" ADD CONSTRAINT "AlertSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlertEvent" ADD CONSTRAINT "AlertEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportTemplate" ADD CONSTRAINT "ReportTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportTemplate" ADD CONSTRAINT "ReportTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
