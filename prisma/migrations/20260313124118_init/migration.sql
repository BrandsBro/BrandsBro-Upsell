-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'PRO');

-- CreateEnum
CREATE TYPE "FunnelStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FunnelType" AS ENUM ('POST_PURCHASE', 'PRE_PURCHASE_CART', 'PRE_PURCHASE_PRODUCT');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('IMPRESSION', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnels" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FunnelStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "FunnelType" NOT NULL DEFAULT 'POST_PURCHASE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "offerProductId" TEXT NOT NULL,
    "offerVariantId" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "triggerRules" JSONB NOT NULL DEFAULT '{}',
    "abTestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "abVariants" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_events" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "eventType" "EventType" NOT NULL,
    "variantId" TEXT,
    "revenueAdded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upsell_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_shopDomain_key" ON "shops"("shopDomain");

-- CreateIndex
CREATE INDEX "funnels_shopId_status_idx" ON "funnels"("shopId", "status");

-- CreateIndex
CREATE INDEX "upsell_events_shopId_createdAt_idx" ON "upsell_events"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "upsell_events_funnelId_eventType_idx" ON "upsell_events"("funnelId", "eventType");

-- AddForeignKey
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_events" ADD CONSTRAINT "upsell_events_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_events" ADD CONSTRAINT "upsell_events_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
