-- Stage 21I-K: maker-checker financial-period closure with immutable revisioned close packs.

CREATE TABLE "PmsFinancialPeriodClose" (
  "id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "snapshotHash" VARCHAR(64) NOT NULL,
  "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
  "reviewReason" TEXT NOT NULL,
  "closeReason" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL,
  "reopenedAt" TIMESTAMP(3),
  "reopenReason" TEXT,
  "companyId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "reviewEventId" TEXT NOT NULL,
  "reviewedById" TEXT NOT NULL,
  "closedById" TEXT NOT NULL,
  "reopenedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PmsFinancialPeriodClose_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PmsFinancialPeriodClose_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "PmsFinancialPeriodClose_snapshot_version_check" CHECK ("snapshotVersion" = 1),
  CONSTRAINT "PmsFinancialPeriodClose_snapshot_hash_check" CHECK ("snapshotHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "PmsFinancialPeriodClose_maker_checker_check" CHECK ("reviewedById" <> "closedById"),
  CONSTRAINT "PmsFinancialPeriodClose_reason_check" CHECK (
    char_length(btrim("reviewReason")) >= 3
    AND char_length(btrim("closeReason")) >= 3
    AND ("reopenReason" IS NULL OR char_length(btrim("reopenReason")) >= 3)
  ),
  CONSTRAINT "PmsFinancialPeriodClose_reopen_fields_check" CHECK (
    ("reopenedAt" IS NULL AND "reopenReason" IS NULL AND "reopenedById" IS NULL)
    OR ("reopenedAt" IS NOT NULL AND "reopenReason" IS NOT NULL AND "reopenedById" IS NOT NULL)
  )
);

ALTER TABLE "PmsFinancialPeriodClose"
  ADD CONSTRAINT "PmsFinancialPeriodClose_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsFinancialPeriodClose_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "PmsFinancialPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsFinancialPeriodClose_reviewEventId_fkey"
    FOREIGN KEY ("reviewEventId") REFERENCES "PmsFinancialPeriodEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsFinancialPeriodClose_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsFinancialPeriodClose_closedById_fkey"
    FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PmsFinancialPeriodClose_reopenedById_fkey"
    FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PmsFinancialPeriodClose_periodId_revision_key"
  ON "PmsFinancialPeriodClose"("periodId", "revision");
CREATE UNIQUE INDEX "PmsFinancialPeriodClose_reviewEventId_key"
  ON "PmsFinancialPeriodClose"("reviewEventId");
CREATE UNIQUE INDEX "PmsFinancialPeriodClose_one_active_close_idx"
  ON "PmsFinancialPeriodClose"("periodId") WHERE "reopenedAt" IS NULL;
CREATE INDEX "PmsFinancialPeriodClose_company_closedAt_idx"
  ON "PmsFinancialPeriodClose"("companyId", "closedAt");
CREATE INDEX "PmsFinancialPeriodClose_period_closedAt_idx"
  ON "PmsFinancialPeriodClose"("periodId", "closedAt");
CREATE INDEX "PmsFinancialPeriodClose_reviewedById_idx"
  ON "PmsFinancialPeriodClose"("reviewedById");
CREATE INDEX "PmsFinancialPeriodClose_closedById_idx"
  ON "PmsFinancialPeriodClose"("closedById");
CREATE INDEX "PmsFinancialPeriodClose_reopenedById_idx"
  ON "PmsFinancialPeriodClose"("reopenedById");

CREATE OR REPLACE FUNCTION "pms_protect_linked_financial_period_review_event"()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PmsFinancialPeriodClose" close_pack
    WHERE close_pack."reviewEventId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Linked PMS financial period review events are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsFinancialPeriodEvent_linked_review_guard"
BEFORE UPDATE OR DELETE ON "PmsFinancialPeriodEvent"
FOR EACH ROW EXECUTE FUNCTION "pms_protect_linked_financial_period_review_event"();

CREATE OR REPLACE FUNCTION "pms_protect_financial_period_close"()
RETURNS trigger AS $$
DECLARE
  period_company_id TEXT;
  period_status "PmsFinancialPeriodStatus";
  period_closed_at TIMESTAMP(3);
  period_close_reason TEXT;
  period_updated_by_id TEXT;
  event_company_id TEXT;
  event_period_id TEXT;
  event_to_status "PmsFinancialPeriodStatus";
  event_created_by_id TEXT;
  event_reason TEXT;
  event_created_at TIMESTAMP(3);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PMS financial period close packs cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (
      NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."revision" IS DISTINCT FROM OLD."revision"
      OR NEW."snapshot" IS DISTINCT FROM OLD."snapshot"
      OR NEW."snapshotHash" IS DISTINCT FROM OLD."snapshotHash"
      OR NEW."snapshotVersion" IS DISTINCT FROM OLD."snapshotVersion"
      OR NEW."reviewReason" IS DISTINCT FROM OLD."reviewReason"
      OR NEW."closeReason" IS DISTINCT FROM OLD."closeReason"
      OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt"
      OR NEW."closedAt" IS DISTINCT FROM OLD."closedAt"
      OR NEW."companyId" IS DISTINCT FROM OLD."companyId"
      OR NEW."periodId" IS DISTINCT FROM OLD."periodId"
      OR NEW."reviewEventId" IS DISTINCT FROM OLD."reviewEventId"
      OR NEW."reviewedById" IS DISTINCT FROM OLD."reviewedById"
      OR NEW."closedById" IS DISTINCT FROM OLD."closedById"
      OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    ) THEN
      RAISE EXCEPTION 'PMS financial period close-pack evidence is immutable';
    END IF;

    IF OLD."reopenedAt" IS NOT NULL THEN
      IF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
        RAISE EXCEPTION 'Reopened PMS financial period close packs are immutable';
      END IF;
      RETURN NEW;
    END IF;

    IF NEW."reopenedAt" IS NULL OR NEW."reopenReason" IS NULL OR NEW."reopenedById" IS NULL THEN
      RAISE EXCEPTION 'Reopening a PMS financial period close pack requires timestamp, actor, and reason';
    END IF;
    RETURN NEW;
  END IF;

  SELECT period."companyId", period."status", period."closedAt", period."closeReason", period."updatedById"
    INTO period_company_id, period_status, period_closed_at, period_close_reason, period_updated_by_id
  FROM "PmsFinancialPeriod" period
  WHERE period."id" = NEW."periodId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PMS financial period not found for close pack';
  END IF;
  IF period_company_id <> NEW."companyId" THEN
    RAISE EXCEPTION 'PMS financial period close pack must match the period company';
  END IF;
  IF period_status <> 'CLOSED' THEN
    RAISE EXCEPTION 'PMS financial period must be closed before its close pack is recorded';
  END IF;
  IF period_closed_at IS DISTINCT FROM NEW."closedAt"
    OR period_close_reason IS DISTINCT FROM NEW."closeReason"
    OR period_updated_by_id IS DISTINCT FROM NEW."closedById" THEN
    RAISE EXCEPTION 'PMS financial period close-pack evidence must match the period close state';
  END IF;

  SELECT event."companyId", event."periodId", event."toStatus", event."createdById", event."reason", event."createdAt"
    INTO event_company_id, event_period_id, event_to_status, event_created_by_id, event_reason, event_created_at
  FROM "PmsFinancialPeriodEvent" event
  WHERE event."id" = NEW."reviewEventId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PMS financial period review event not found for close pack';
  END IF;
  IF event_company_id <> NEW."companyId" OR event_period_id <> NEW."periodId" OR event_to_status <> 'REVIEWING' THEN
    RAISE EXCEPTION 'PMS financial period close pack must reference its own review transition';
  END IF;
  IF event_created_by_id IS NULL OR event_created_by_id <> NEW."reviewedById" THEN
    RAISE EXCEPTION 'PMS financial period close-pack reviewer must match the review transition actor';
  END IF;
  IF event_created_at IS DISTINCT FROM NEW."reviewedAt"
    OR COALESCE(event_reason, 'Financial period reviewed') IS DISTINCT FROM NEW."reviewReason" THEN
    RAISE EXCEPTION 'PMS financial period close-pack review evidence must match the review transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsFinancialPeriodClose_immutable_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "PmsFinancialPeriodClose"
FOR EACH ROW EXECUTE FUNCTION "pms_protect_financial_period_close"();

CREATE OR REPLACE FUNCTION "pms_protect_financial_period_close_fields"()
RETURNS trigger AS $$
BEGIN
  IF (
    NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."companyId" IS DISTINCT FROM OLD."companyId"
    OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."periodStart" IS DISTINCT FROM OLD."periodStart"
    OR NEW."periodEnd" IS DISTINCT FROM OLD."periodEnd"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'PMS financial period scope is immutable; create a replacement period instead';
  END IF;

  IF OLD."status" = 'CLOSED' AND NEW."status" = 'CLOSED' AND (
    NEW."closedAt" IS DISTINCT FROM OLD."closedAt"
    OR NEW."closeReason" IS DISTINCT FROM OLD."closeReason"
    OR NEW."reopenedAt" IS DISTINCT FROM OLD."reopenedAt"
    OR NEW."reopenReason" IS DISTINCT FROM OLD."reopenReason"
  ) THEN
    RAISE EXCEPTION 'Closed PMS financial period evidence is immutable; reopen through the governed workflow';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PmsFinancialPeriod_close_fields_guard"
BEFORE UPDATE ON "PmsFinancialPeriod"
FOR EACH ROW EXECUTE FUNCTION "pms_protect_financial_period_close_fields"();

CREATE OR REPLACE FUNCTION "pms_validate_financial_period_close_state"()
RETURNS trigger AS $$
DECLARE
  active_close_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_close_count
  FROM "PmsFinancialPeriodClose" close_pack
  WHERE close_pack."periodId" = NEW."id"
    AND close_pack."reopenedAt" IS NULL;

  IF NEW."status" = 'CLOSED' AND active_close_count <> 1 THEN
    RAISE EXCEPTION 'Closed PMS financial periods require exactly one active close pack';
  END IF;
  IF NEW."status" <> 'CLOSED' AND active_close_count <> 0 THEN
    RAISE EXCEPTION 'Open or reviewing PMS financial periods cannot retain an active close pack';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "PmsFinancialPeriod_close_state_guard"
AFTER UPDATE OF "status" ON "PmsFinancialPeriod"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "pms_validate_financial_period_close_state"();

CREATE OR REPLACE FUNCTION "pms_validate_close_pack_period_state"()
RETURNS trigger AS $$
DECLARE
  period_status "PmsFinancialPeriodStatus";
  period_reopened_at TIMESTAMP(3);
  period_reopen_reason TEXT;
  period_updated_by_id TEXT;
  active_close_count INTEGER;
BEGIN
  SELECT period."status", period."reopenedAt", period."reopenReason", period."updatedById"
    INTO period_status, period_reopened_at, period_reopen_reason, period_updated_by_id
  FROM "PmsFinancialPeriod" period
  WHERE period."id" = NEW."periodId";

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO active_close_count
  FROM "PmsFinancialPeriodClose" close_pack
  WHERE close_pack."periodId" = NEW."periodId"
    AND close_pack."reopenedAt" IS NULL;

  IF period_status = 'CLOSED' AND active_close_count <> 1 THEN
    RAISE EXCEPTION 'Closed PMS financial periods require exactly one active close pack';
  END IF;
  IF period_status <> 'CLOSED' AND active_close_count <> 0 THEN
    RAISE EXCEPTION 'Open or reviewing PMS financial periods cannot retain an active close pack';
  END IF;
  IF NEW."reopenedAt" IS NOT NULL AND (
    period_reopened_at IS DISTINCT FROM NEW."reopenedAt"
    OR period_reopen_reason IS DISTINCT FROM NEW."reopenReason"
    OR period_updated_by_id IS DISTINCT FROM NEW."reopenedById"
  ) THEN
    RAISE EXCEPTION 'PMS financial period reopen evidence must match its close-pack revision';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "PmsFinancialPeriodClose_period_state_guard"
AFTER INSERT OR UPDATE ON "PmsFinancialPeriodClose"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "pms_validate_close_pack_period_state"();
