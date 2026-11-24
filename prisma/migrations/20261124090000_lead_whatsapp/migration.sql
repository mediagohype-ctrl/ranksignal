-- Free check: WhatsApp number and ad attribution (UTM / fbclid) on leads.
ALTER TABLE "public"."Lead" ADD COLUMN "phone" TEXT;
ALTER TABLE "public"."Lead" ADD COLUMN "attribution" JSONB;
CREATE INDEX "Lead_phone_idx" ON "public"."Lead"("phone");
