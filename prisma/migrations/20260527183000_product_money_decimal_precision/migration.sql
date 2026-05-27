-- Store product selling price, cost, and discount as fixed-precision money.
ALTER TABLE "Product"
  ALTER COLUMN "price" TYPE DECIMAL(18, 2) USING ROUND("price"::numeric, 2),
  ALTER COLUMN "cost" TYPE DECIMAL(18, 2) USING ROUND("cost"::numeric, 2),
  ALTER COLUMN "discountAmount" TYPE DECIMAL(18, 2) USING ROUND("discountAmount"::numeric, 2);
