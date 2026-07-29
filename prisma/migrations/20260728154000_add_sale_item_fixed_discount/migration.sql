-- Add a fixed discount amount that applies to the complete sale line.
-- IF NOT EXISTS keeps this additive migration safe for environments where the
-- column may already have been introduced manually.
ALTER TABLE "sale_items"
ADD COLUMN IF NOT EXISTS "fixedDiscount" DECIMAL(18, 2) NOT NULL DEFAULT 0;
