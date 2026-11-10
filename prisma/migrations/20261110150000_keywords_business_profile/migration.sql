-- Search Console keyword stars (Keywords > Tracked) and the Google Business Profile monitor (Places API snapshots).
-- CreateTable
CREATE TABLE "public"."KeywordStar" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordStar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusinessProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdById" TEXT,
    "lastSnapshotAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusinessProfileSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "businessStatus" TEXT,
    "data" JSONB NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'schedule',
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordStar_organizationId_projectId_idx" ON "public"."KeywordStar"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordStar_projectId_query_key" ON "public"."KeywordStar"("projectId", "query");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_projectId_key" ON "public"."BusinessProfile"("projectId");

-- CreateIndex
CREATE INDEX "BusinessProfile_organizationId_idx" ON "public"."BusinessProfile"("organizationId");

-- CreateIndex
CREATE INDEX "BusinessProfileSnapshot_organizationId_profileId_takenAt_idx" ON "public"."BusinessProfileSnapshot"("organizationId", "profileId", "takenAt");

-- AddForeignKey
ALTER TABLE "public"."KeywordStar" ADD CONSTRAINT "KeywordStar_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessProfile" ADD CONSTRAINT "BusinessProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessProfileSnapshot" ADD CONSTRAINT "BusinessProfileSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
