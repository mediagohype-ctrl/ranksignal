-- Free check + free tool usage log (admin "Free tool usage" page and team alert emails).
-- CreateTable
CREATE TABLE "public"."ToolUse" (
    "id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "url" TEXT,
    "input" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "status" INTEGER NOT NULL DEFAULT 200,
    "errorCode" TEXT,
    "score" INTEGER,
    "aiCostMicros" INTEGER NOT NULL DEFAULT 0,
    "aiModel" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "email" TEXT,
    "leadId" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "country" TEXT,
    "language" TEXT,
    "referrer" TEXT,
    "alerted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolUse_createdAt_idx" ON "public"."ToolUse"("createdAt");
CREATE INDEX "ToolUse_tool_createdAt_idx" ON "public"."ToolUse"("tool", "createdAt");
CREATE INDEX "ToolUse_ipHash_tool_createdAt_idx" ON "public"."ToolUse"("ipHash", "tool", "createdAt");
CREATE INDEX "ToolUse_leadId_idx" ON "public"."ToolUse"("leadId");
