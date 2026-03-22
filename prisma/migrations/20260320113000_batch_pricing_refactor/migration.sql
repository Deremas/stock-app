ALTER TABLE "products"
DROP COLUMN "defaultCostPrice",
DROP COLUMN "defaultSellingPrice";

ALTER TABLE "purchase_items"
RENAME COLUMN "defaultSellingPrice" TO "sellingPrice";
