-- Additive compatibility bridge for the legacy location-oriented production
-- schema. Existing columns, tables, enum values, and historical rows are kept.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettlementStatus') THEN
    CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');
  END IF;
END
$$;

ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'SELLER_SETTLEMENT';
ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'SELLER_COLLECTION';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'SELLER_INTAKE';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'SELLER_ASSIGNMENT';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'SELLER_RETURN';
ALTER TYPE "StockOwnershipType" ADD VALUE IF NOT EXISTS 'SELLER_CONSIGNMENT';
ALTER TYPE "StockOwnershipType" ADD VALUE IF NOT EXISTS 'SELLER_ASSIGNED';

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "barcode" TEXT,
  ADD COLUMN IF NOT EXISTS "color" TEXT,
  ADD COLUMN IF NOT EXISTS "compatibilityNote" TEXT,
  ADD COLUMN IF NOT EXISTS "connectorType" TEXT,
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "serialTracking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS "variant" TEXT,
  ADD COLUMN IF NOT EXISTS "warrantyDays" INTEGER;

ALTER TABLE "purchase_items"
  ADD COLUMN IF NOT EXISTS "quantityTransferred" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "transfer_items"
  ADD COLUMN IF NOT EXISTS "quantityTransferred" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "sales"
SET "branchId" = "locationId"
WHERE "branchId" IS NULL AND "locationId" IS NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "purchases"
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentAccountId" TEXT;
UPDATE "purchases"
SET
  "branchId" = COALESCE("branchId", "locationId"),
  "paymentAccountId" = COALESCE("paymentAccountId", "financeAccountId");
ALTER TABLE "purchases" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "expenses"
SET "branchId" = "locationId"
WHERE "branchId" IS NULL AND "locationId" IS NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "customer_payments" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "customer_payments"
SET "branchId" = "locationId"
WHERE "branchId" IS NULL AND "locationId" IS NOT NULL;
ALTER TABLE "customer_payments" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "supplier_payments" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "supplier_payments"
SET "branchId" = "locationId"
WHERE "branchId" IS NULL AND "locationId" IS NOT NULL;
ALTER TABLE "supplier_payments" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "finance_accounts" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "finance_accounts"
SET "branchId" = "locationId"
WHERE "branchId" IS NULL AND "locationId" IS NOT NULL;

ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "ledger_entries"
SET "branchId" = "locationId"
WHERE "branchId" IS NULL AND "locationId" IS NOT NULL;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
UPDATE "audit_logs"
SET "branchId" = "locationId"
WHERE "branchId" IS NULL AND "locationId" IS NOT NULL;

ALTER TABLE "alert_records"
  ADD COLUMN IF NOT EXISTS "alertType" TEXT,
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "isResolved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quantityAtAlert" INTEGER,
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
UPDATE "alert_records"
SET
  "alertType" = COALESCE("alertType", 'LOW_STOCK'),
  "branchId" = COALESCE("branchId", "locationId"),
  "quantityAtAlert" = COALESCE("quantityAtAlert", "currentQty");
ALTER TABLE "alert_records"
  ALTER COLUMN "alertType" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL,
  ALTER COLUMN "quantityAtAlert" SET NOT NULL;

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "ownershipType" "StockOwnershipType";
UPDATE "stock_movements"
SET
  "branchId" = COALESCE("branchId", "locationId"),
  "ownershipType" = COALESCE("ownershipType", 'OWNED'::"StockOwnershipType");
ALTER TABLE "stock_movements"
  ALTER COLUMN "branchId" SET NOT NULL,
  ALTER COLUMN "ownershipType" SET NOT NULL;

ALTER TABLE "transfers"
  ADD COLUMN IF NOT EXISTS "sourceBranchId" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationBranchId" TEXT;
UPDATE "transfers"
SET
  "sourceBranchId" = COALESCE("sourceBranchId", "sourceLocationId"),
  "destinationBranchId" = COALESCE(
    "destinationBranchId",
    "destinationLocationId"
  );
ALTER TABLE "transfers"
  ALTER COLUMN "sourceBranchId" SET NOT NULL,
  ALTER COLUMN "destinationBranchId" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "sellers" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT,
  "alternatePhone" TEXT,
  "address" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sale_item_allocations" (
  "id" TEXT NOT NULL,
  "saleItemId" TEXT NOT NULL,
  "sourceType" "StockOwnershipType" NOT NULL,
  "purchaseItemId" TEXT,
  "transferItemId" TEXT,
  "sellerIntakeItemId" TEXT,
  "sellerAssignmentItemId" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(18,2),
  "sellerAmount" DECIMAL(18,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_item_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_intakes" (
  "id" TEXT NOT NULL,
  "intakeNumber" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "bringingDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_intakes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_intake_items" (
  "id" TEXT NOT NULL,
  "sellerIntakeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantityBrought" INTEGER NOT NULL,
  "quantityAssigned" INTEGER NOT NULL DEFAULT 0,
  "quantitySold" INTEGER NOT NULL DEFAULT 0,
  "quantityReturned" INTEGER NOT NULL DEFAULT 0,
  "sellerFixedPrice" DECIMAL(18,2) NOT NULL,
  "targetSellingPrice" DECIMAL(18,2),
  "serialNumbers" JSONB,
  "bringingDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_intake_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_assignments" (
  "id" TEXT NOT NULL,
  "assignmentNumber" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "assignmentDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_assignment_items" (
  "id" TEXT NOT NULL,
  "sellerAssignmentId" TEXT NOT NULL,
  "sellerIntakeItemId" TEXT,
  "purchaseItemId" TEXT,
  "transferItemId" TEXT,
  "productId" TEXT NOT NULL,
  "quantityAssigned" INTEGER NOT NULL,
  "quantitySold" INTEGER NOT NULL DEFAULT 0,
  "quantityReturned" INTEGER NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(18,2),
  "sellingPrice" DECIMAL(18,2),
  "assignmentDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_assignment_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_returns" (
  "id" TEXT NOT NULL,
  "returnNumber" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "returnDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_return_items" (
  "id" TEXT NOT NULL,
  "sellerReturnId" TEXT NOT NULL,
  "sellerIntakeItemId" TEXT,
  "sellerAssignmentItemId" TEXT,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_return_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_settlements" (
  "id" TEXT NOT NULL,
  "settlementNumber" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "financeAccountId" TEXT,
  "settlementDate" TIMESTAMP(3) NOT NULL,
  "paymentMethod" "AccountType" NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'POSTED',
  "amount" DECIMAL(18,2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_settlement_allocations" (
  "id" TEXT NOT NULL,
  "sellerSettlementId" TEXT NOT NULL,
  "saleItemAllocationId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_settlement_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_collections" (
  "id" TEXT NOT NULL,
  "collectionNumber" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "financeAccountId" TEXT,
  "collectionDate" TIMESTAMP(3) NOT NULL,
  "paymentMethod" "AccountType" NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'POSTED',
  "amount" DECIMAL(18,2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_collection_allocations" (
  "id" TEXT NOT NULL,
  "sellerCollectionId" TEXT NOT NULL,
  "saleItemAllocationId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_collection_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stock_balance_snapshots" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "ownershipType" "StockOwnershipType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "averageCost" DECIMAL(18,2),
  "stockValue" DECIMAL(18,2),
  "snapshotDate" TIMESTAMP(3) NOT NULL,
  "sourceKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_balance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sellers_phone_key"
  ON "sellers"("phone");
CREATE INDEX IF NOT EXISTS "sellers_fullName_idx"
  ON "sellers"("fullName");
CREATE UNIQUE INDEX IF NOT EXISTS "seller_intakes_intakeNumber_key"
  ON "seller_intakes"("intakeNumber");
CREATE INDEX IF NOT EXISTS "seller_intakes_sellerId_bringingDate_idx"
  ON "seller_intakes"("sellerId", "bringingDate");
CREATE INDEX IF NOT EXISTS "seller_intake_items_productId_bringingDate_idx"
  ON "seller_intake_items"("productId", "bringingDate");
CREATE UNIQUE INDEX IF NOT EXISTS "seller_assignments_assignmentNumber_key"
  ON "seller_assignments"("assignmentNumber");
CREATE INDEX IF NOT EXISTS "seller_assignments_sellerId_assignmentDate_idx"
  ON "seller_assignments"("sellerId", "assignmentDate");
CREATE INDEX IF NOT EXISTS "seller_assignment_items_productId_assignmentDate_idx"
  ON "seller_assignment_items"("productId", "assignmentDate");
CREATE INDEX IF NOT EXISTS "seller_assignment_items_purchaseItemId_idx"
  ON "seller_assignment_items"("purchaseItemId");
CREATE INDEX IF NOT EXISTS "seller_assignment_items_transferItemId_idx"
  ON "seller_assignment_items"("transferItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "seller_returns_returnNumber_key"
  ON "seller_returns"("returnNumber");
CREATE INDEX IF NOT EXISTS "seller_returns_sellerId_returnDate_idx"
  ON "seller_returns"("sellerId", "returnDate");
CREATE UNIQUE INDEX IF NOT EXISTS "seller_settlements_settlementNumber_key"
  ON "seller_settlements"("settlementNumber");
CREATE INDEX IF NOT EXISTS "seller_settlements_sellerId_settlementDate_idx"
  ON "seller_settlements"("sellerId", "settlementDate");
CREATE UNIQUE INDEX IF NOT EXISTS "seller_collections_collectionNumber_key"
  ON "seller_collections"("collectionNumber");
CREATE INDEX IF NOT EXISTS "seller_collections_sellerId_collectionDate_idx"
  ON "seller_collections"("sellerId", "collectionDate");
CREATE INDEX IF NOT EXISTS "stock_balance_snapshots_branchId_productId_snapshotDate_idx"
  ON "stock_balance_snapshots"("branchId", "productId", "snapshotDate");
CREATE INDEX IF NOT EXISTS "alert_records_branchId_createdAt_idx"
  ON "alert_records"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "expenses_branchId_expenseDate_idx"
  ON "expenses"("branchId", "expenseDate");
CREATE INDEX IF NOT EXISTS "finance_accounts_branchId_type_idx"
  ON "finance_accounts"("branchId", "type");
CREATE INDEX IF NOT EXISTS "ledger_entries_branchId_entryDate_idx"
  ON "ledger_entries"("branchId", "entryDate");
CREATE INDEX IF NOT EXISTS "purchases_branchId_purchasedAt_idx"
  ON "purchases"("branchId", "purchasedAt");
CREATE INDEX IF NOT EXISTS "purchases_supplierId_purchasedAt_idx"
  ON "purchases"("supplierId", "purchasedAt");
CREATE INDEX IF NOT EXISTS "sales_branchId_soldAt_idx"
  ON "sales"("branchId", "soldAt");
CREATE INDEX IF NOT EXISTS "stock_movements_branchId_productId_movementDate_idx"
  ON "stock_movements"("branchId", "productId", "movementDate");
CREATE INDEX IF NOT EXISTS "transfers_sourceBranchId_createdAt_idx"
  ON "transfers"("sourceBranchId", "createdAt");
CREATE INDEX IF NOT EXISTS "transfers_destinationBranchId_createdAt_idx"
  ON "transfers"("destinationBranchId", "createdAt");

