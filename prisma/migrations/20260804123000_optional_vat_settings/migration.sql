CREATE TYPE "TaxTreatment" AS ENUM (
  'NONE',
  'STANDARD',
  'ZERO_RATED',
  'EXEMPT',
  'OUT_OF_SCOPE'
);

CREATE TYPE "TaxPriceMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE');

CREATE TYPE "PurchaseVatTreatment" AS ENUM (
  'RECOVERABLE',
  'NON_RECOVERABLE'
);

CREATE TYPE "SalePaymentAllocationMethod" AS ENUM ('CASH', 'BANK', 'CREDIT');

ALTER TABLE "purchases"
ADD COLUMN "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'NONE',
ADD COLUMN "taxRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
ADD COLUMN "taxableAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "vatTreatment" "PurchaseVatTreatment" NOT NULL DEFAULT 'RECOVERABLE';

ALTER TABLE "sales"
ADD COLUMN "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'NONE',
ADD COLUMN "taxRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
ADD COLUMN "taxableAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
ADD COLUMN "taxAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "purchase_items"
ADD COLUMN "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'NONE',
ADD COLUMN "taxRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
ADD COLUMN "taxableAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
ADD COLUMN "taxAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sale_items"
ADD COLUMN "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'NONE',
ADD COLUMN "taxRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
ADD COLUMN "taxableAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
ADD COLUMN "taxAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "business_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
  "salesVatEnabled" BOOLEAN NOT NULL DEFAULT false,
  "purchaseVatEnabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultSalesVatRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "defaultPurchaseVatRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "salesPriceMode" "TaxPriceMode" NOT NULL DEFAULT 'EXCLUSIVE',
  "purchasePriceMode" "TaxPriceMode" NOT NULL DEFAULT 'EXCLUSIVE',
  "purchaseVatTreatment" "PurchaseVatTreatment" NOT NULL DEFAULT 'RECOVERABLE',
  "businessTaxId" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "business_settings" (
  "id",
  "updatedAt"
) VALUES (
  'default',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "sale_payment_allocations" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "financeAccountId" TEXT,
  "method" "SalePaymentAllocationMethod" NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_payment_allocations_saleId_idx"
ON "sale_payment_allocations"("saleId");

CREATE INDEX "sale_payment_allocations_financeAccountId_createdAt_idx"
ON "sale_payment_allocations"("financeAccountId", "createdAt");

ALTER TABLE "sale_payment_allocations"
ADD CONSTRAINT "sale_payment_allocations_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "sales"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_payment_allocations"
ADD CONSTRAINT "sale_payment_allocations_financeAccountId_fkey"
FOREIGN KEY ("financeAccountId") REFERENCES "finance_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "sale_payment_allocations" (
  "id", "saleId", "financeAccountId", "method", "amount", "createdAt"
)
SELECT
  'legacy_' || md5(s."id" || ':' || le."financeAccountId"),
  s."id",
  le."financeAccountId",
  CASE
    WHEN fa."type" = 'BANK' THEN 'BANK'::"SalePaymentAllocationMethod"
    ELSE 'CASH'::"SalePaymentAllocationMethod"
  END,
  SUM(le."amount"),
  MIN(le."createdAt")
FROM "sales" s
JOIN "ledger_entries" le
  ON le."referenceType" = 'Sale'
  AND le."referenceId" = s."id"
  AND le."entryType" = 'SALE'
  AND le."direction" = 'DEBIT'
JOIN "finance_accounts" fa ON fa."id" = le."financeAccountId"
GROUP BY s."id", le."financeAccountId", fa."type";

INSERT INTO "sale_payment_allocations" (
  "id", "saleId", "financeAccountId", "method", "amount", "createdAt"
)
SELECT
  'legacy_credit_' || md5(s."id"),
  s."id",
  NULL,
  'CREDIT'::"SalePaymentAllocationMethod",
  s."amountDue",
  s."createdAt"
FROM "sales" s
WHERE s."amountDue" > 0;
