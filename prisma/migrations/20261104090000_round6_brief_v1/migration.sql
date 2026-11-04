-- Developer brief v1: time zones, expert mode, Google sign-in, WhatsApp, referrals, confirmed facts, message log.
ALTER TABLE "public"."Organization" ADD COLUMN "whatsappNumber" TEXT,
ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "referralCode" TEXT,
ADD COLUMN "referredById" TEXT;
CREATE UNIQUE INDEX "Organization_referralCode_key" ON "public"."Organization"("referralCode");

ALTER TABLE "public"."User" ADD COLUMN "timeZone" TEXT,
ADD COLUMN "expertMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "User_googleId_key" ON "public"."User"("googleId");

ALTER TABLE "public"."Project" ADD COLUMN "facts" JSONB;

CREATE TABLE "public"."SentMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SentMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SentMessage_kind_key_key" ON "public"."SentMessage"("kind", "key");
CREATE INDEX "SentMessage_organizationId_createdAt_idx" ON "public"."SentMessage"("organizationId", "createdAt");
