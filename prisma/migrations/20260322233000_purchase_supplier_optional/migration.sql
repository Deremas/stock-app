ALTER TABLE "purchases" ALTER COLUMN "supplierId" DROP NOT NULL;

ALTER TABLE "purchases" DROP CONSTRAINT "purchases_supplierId_fkey";

ALTER TABLE "purchases"
ADD CONSTRAINT "purchases_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
