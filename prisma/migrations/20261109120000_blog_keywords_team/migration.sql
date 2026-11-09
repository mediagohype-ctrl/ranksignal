-- Blog CMS (/blog), SEO keyword tracker, and the internal team workspace flag.
-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaTitle" TEXT,
    "description" TEXT NOT NULL,
    "answer" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "keyPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "faqs" JSONB,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL DEFAULT 'SEO',
    "coverImageUrl" TEXT,
    "authorName" TEXT NOT NULL,
    "authorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeoKeyword" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "pillar" TEXT NOT NULL DEFAULT 'seo',
    "intent" TEXT NOT NULL DEFAULT 'informational',
    "targetPath" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "googlePosition" INTEGER,
    "aiMentioned" BOOLEAN,
    "notes" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "public"."BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "public"."BlogPost"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeyword_phrase_key" ON "public"."SeoKeyword"("phrase");

-- CreateIndex
CREATE INDEX "SeoKeyword_priority_idx" ON "public"."SeoKeyword"("priority");

