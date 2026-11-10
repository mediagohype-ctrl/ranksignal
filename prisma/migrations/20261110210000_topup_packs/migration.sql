-- One-time AI-answer top-up packs: Razorpay orders, granted packs, and the monthly settlement of extra-answer use.
-- CreateTable
CREATE TABLE "public"."TopUpOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "answers" INTEGER NOT NULL,
    "basePaise" INTEGER NOT NULL,
    "gstPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "ratePercent" DOUBLE PRECISION NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "receipt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "razorpayPaymentId" TEXT,
    "failureReason" TEXT,
    "createdById" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundedPaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopUpOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TopUpPack" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "answers" INTEGER NOT NULL,
    "basePaise" INTEGER NOT NULL,
    "razorpayPaymentId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "settledThrough" TIMESTAMP(3) NOT NULL,
    "revokedAnswers" INTEGER NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopUpPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TopUpSettlement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "cap" INTEGER NOT NULL,
    "collected" INTEGER NOT NULL,
    "overflow" INTEGER NOT NULL,
    "allocated" INTEGER NOT NULL,
    "allocations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopUpSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopUpOrder_razorpayOrderId_key" ON "public"."TopUpOrder"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "TopUpOrder_receipt_key" ON "public"."TopUpOrder"("receipt");

-- CreateIndex
CREATE UNIQUE INDEX "TopUpOrder_razorpayPaymentId_key" ON "public"."TopUpOrder"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "TopUpOrder_organizationId_createdAt_idx" ON "public"."TopUpOrder"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopUpPack_orderId_key" ON "public"."TopUpPack"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "TopUpPack_razorpayPaymentId_key" ON "public"."TopUpPack"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "TopUpPack_organizationId_expiresAt_idx" ON "public"."TopUpPack"("organizationId", "expiresAt");

-- CreateIndex
CREATE INDEX "TopUpPack_settledThrough_idx" ON "public"."TopUpPack"("settledThrough");

-- CreateIndex
CREATE UNIQUE INDEX "TopUpSettlement_organizationId_month_key" ON "public"."TopUpSettlement"("organizationId", "month");

-- AddForeignKey
ALTER TABLE "public"."TopUpOrder" ADD CONSTRAINT "TopUpOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TopUpPack" ADD CONSTRAINT "TopUpPack_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TopUpPack" ADD CONSTRAINT "TopUpPack_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."TopUpOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TopUpSettlement" ADD CONSTRAINT "TopUpSettlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
