CREATE TYPE "PriceQualifier" AS ENUM (
  'FIXED',
  'FROM',
  'ON_REQUEST'
);

CREATE TYPE "PriceUnit" AS ENUM (
  'TOTAL',
  'NIGHT',
  'MONTH',
  'YEAR',
  'PERSON',
  'GROUP',
  'HOUR',
  'DAY',
  'ACTIVITY'
);

ALTER TABLE "Listing"
ADD COLUMN "priceAmount" DECIMAL(14,3),
ADD COLUMN "priceCurrency" VARCHAR(3),
ADD COLUMN "priceQualifier" "PriceQualifier" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "priceUnit" "PriceUnit";

ALTER TABLE "Activity"
ADD COLUMN "priceAmount" DECIMAL(14,3),
ADD COLUMN "priceCurrency" VARCHAR(3),
ADD COLUMN "priceQualifier" "PriceQualifier" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "priceUnit" "PriceUnit";

UPDATE "Listing"
SET
  "priceAmount" =
    substring(
      replace("price", ',', '')
      from '([0-9]+([.][0-9]+)?)'
    )::DECIMAL(14,3),

  "priceCurrency" =
    CASE
      WHEN upper("price") LIKE '%OMR%'
        OR "price" LIKE '%ر.ع%'
      THEN 'OMR'
      ELSE NULL
    END,

  "priceQualifier" =
    CASE
      WHEN lower(trim("price")) LIKE 'from %'
        OR trim("price") LIKE 'ابتداء%'
      THEN 'FROM'::"PriceQualifier"

      WHEN "price" !~ '[0-9]'
      THEN 'ON_REQUEST'::"PriceQualifier"

      ELSE 'FIXED'::"PriceQualifier"
    END,

  "priceUnit" =
    CASE "paymentFrequency"
      WHEN 'Total sale price'
        THEN 'TOTAL'::"PriceUnit"
      WHEN 'Per night'
        THEN 'NIGHT'::"PriceUnit"
      WHEN 'Per month'
        THEN 'MONTH'::"PriceUnit"
      WHEN 'Per year'
        THEN 'YEAR'::"PriceUnit"
      ELSE NULL
    END;

UPDATE "Activity"
SET
  "priceAmount" =
    substring(
      replace("price", ',', '')
      from '([0-9]+([.][0-9]+)?)'
    )::DECIMAL(14,3),

  "priceCurrency" =
    CASE
      WHEN upper("price") LIKE '%OMR%'
        OR "price" LIKE '%ر.ع%'
      THEN 'OMR'
      ELSE NULL
    END,

  "priceQualifier" =
    CASE
      WHEN lower(trim("price")) LIKE 'from %'
        OR trim("price") LIKE 'ابتداء%'
      THEN 'FROM'::"PriceQualifier"

      WHEN "price" !~ '[0-9]'
      THEN 'ON_REQUEST'::"PriceQualifier"

      ELSE 'FIXED'::"PriceQualifier"
    END;

CREATE INDEX "Listing_status_priceAmount_idx"
ON "Listing"("status", "priceAmount");

CREATE INDEX "Activity_status_priceAmount_idx"
ON "Activity"("status", "priceAmount");
