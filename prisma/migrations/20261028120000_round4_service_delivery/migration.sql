-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "serviceTier" TEXT;

-- CreateTable
CREATE TABLE "public"."ReportSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "crawlRunId" TEXT,
    "visibilityRunId" TEXT,
    "overallScore" INTEGER,
    "grade" TEXT,
    "pillarScores" JSONB,
    "openIssues" JSONB,
    "visibility" JSONB,
    "promptSetVersion" INTEGER,
    "methodologyVersion" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actionId" TEXT,
    "findingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'onsite',
    "performedBy" TEXT NOT NULL DEFAULT 'agency',
    "assigneeId" TEXT,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'backlog',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "clientVisible" BOOLEAN NOT NULL DEFAULT true,
    "shippedUrl" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MonthlyReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payload" JSONB,
    "summary" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lead" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "company" TEXT,
    "url" TEXT,
    "message" TEXT,
    "score" INTEGER,
    "ipHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSnapshot_organizationId_projectId_createdAt_idx" ON "public"."ReportSnapshot"("organizationId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportSnapshot_projectId_kind_createdAt_idx" ON "public"."ReportSnapshot"("projectId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Task_organizationId_projectId_status_idx" ON "public"."Task"("organizationId", "projectId", "status");

-- CreateIndex
CREATE INDEX "Task_projectId_completedAt_idx" ON "public"."Task"("projectId", "completedAt");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_idx" ON "public"."TaskComment"("taskId");

-- CreateIndex
CREATE INDEX "MonthlyReport_organizationId_period_idx" ON "public"."MonthlyReport"("organizationId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReport_projectId_period_key" ON "public"."MonthlyReport"("projectId", "period");

-- CreateIndex
CREATE INDEX "Lead_source_createdAt_idx" ON "public"."Lead"("source", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "public"."Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNote_organizationId_createdAt_idx" ON "public"."AdminNote"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

