ALTER TABLE "seller_assignment_items"
ADD COLUMN "purchaseItemId" TEXT,
ADD COLUMN "transferItemId" TEXT,
ADD COLUMN "unitCost" DECIMAL(18, 2),
ADD COLUMN "sellingPrice" DECIMAL(18, 2);

CREATE INDEX "seller_assignment_items_purchaseItemId_idx"
ON "seller_assignment_items"("purchaseItemId");

CREATE INDEX "seller_assignment_items_transferItemId_idx"
ON "seller_assignment_items"("transferItemId");

ALTER TABLE "seller_assignment_items"
ADD CONSTRAINT "seller_assignment_items_purchaseItemId_fkey"
FOREIGN KEY ("purchaseItemId") REFERENCES "purchase_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "seller_assignment_items"
ADD CONSTRAINT "seller_assignment_items_transferItemId_fkey"
FOREIGN KEY ("transferItemId") REFERENCES "transfer_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
