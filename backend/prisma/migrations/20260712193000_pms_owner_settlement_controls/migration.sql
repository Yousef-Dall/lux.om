-- Preserve published owner statement snapshots and approved payout composition.
CREATE OR REPLACE FUNCTION pms_owner_statement_published_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."publishedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Published PMS owner statements are immutable; void and revise instead';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NOT NULL THEN
    IF NEW."status" <> 'PUBLISHED' THEN
      RAISE EXCEPTION 'Owner statement publication metadata requires PUBLISHED status';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['status', 'publishedAt', 'publishedById', 'updatedAt'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'publishedAt', 'publishedById', 'updatedAt']) THEN
      RAISE EXCEPTION 'Owner statement snapshot fields cannot change during publication';
    END IF;
  ELSIF OLD."publishedAt" IS NOT NULL THEN
    IF OLD."status" <> 'PUBLISHED' OR NEW."status" <> 'VOID' THEN
      RAISE EXCEPTION 'Published PMS owner statements are immutable; void and revise instead';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['status', 'voidedAt', 'voidedById', 'updatedAt'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'voidedAt', 'voidedById', 'updatedAt']) THEN
      RAISE EXCEPTION 'Published PMS owner statement snapshot fields are immutable';
    END IF;
  ELSIF NEW."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published owner statements require publication metadata';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PmsOwnerStatement_published_immutable_update" ON "PmsOwnerStatement";
CREATE TRIGGER "PmsOwnerStatement_published_immutable_update"
BEFORE UPDATE ON "PmsOwnerStatement"
FOR EACH ROW EXECUTE FUNCTION pms_owner_statement_published_immutable();

DROP TRIGGER IF EXISTS "PmsOwnerStatement_published_immutable_delete" ON "PmsOwnerStatement";
CREATE TRIGGER "PmsOwnerStatement_published_immutable_delete"
BEFORE DELETE ON "PmsOwnerStatement"
FOR EACH ROW EXECUTE FUNCTION pms_owner_statement_published_immutable();

CREATE OR REPLACE FUNCTION pms_owner_payout_line_draft_only() RETURNS trigger AS $$
DECLARE
  source_status "PmsOwnerPayoutStatus";
  target_status "PmsOwnerPayoutStatus";
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT "status" INTO source_status FROM "PmsOwnerPayoutBatch" WHERE "id" = OLD."payoutBatchId";
    IF source_status IS DISTINCT FROM 'DRAFT' THEN
      RAISE EXCEPTION 'Approved PMS owner payout composition is immutable';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT "status" INTO target_status FROM "PmsOwnerPayoutBatch" WHERE "id" = NEW."payoutBatchId";
    IF target_status IS DISTINCT FROM 'DRAFT' THEN
      RAISE EXCEPTION 'Approved PMS owner payout composition is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PmsOwnerPayoutLine_draft_only_insert" ON "PmsOwnerPayoutLine";
CREATE TRIGGER "PmsOwnerPayoutLine_draft_only_insert"
BEFORE INSERT ON "PmsOwnerPayoutLine"
FOR EACH ROW EXECUTE FUNCTION pms_owner_payout_line_draft_only();

DROP TRIGGER IF EXISTS "PmsOwnerPayoutLine_draft_only_update" ON "PmsOwnerPayoutLine";
CREATE TRIGGER "PmsOwnerPayoutLine_draft_only_update"
BEFORE UPDATE ON "PmsOwnerPayoutLine"
FOR EACH ROW EXECUTE FUNCTION pms_owner_payout_line_draft_only();

DROP TRIGGER IF EXISTS "PmsOwnerPayoutLine_draft_only_delete" ON "PmsOwnerPayoutLine";
CREATE TRIGGER "PmsOwnerPayoutLine_draft_only_delete"
BEFORE DELETE ON "PmsOwnerPayoutLine"
FOR EACH ROW EXECUTE FUNCTION pms_owner_payout_line_draft_only();

CREATE OR REPLACE FUNCTION pms_owner_payout_financials_immutable_after_draft() RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' OR NEW."status" <> 'DRAFT' THEN
    IF (to_jsonb(NEW) - ARRAY[
      'status', 'approvedAt', 'approvedById', 'processingAt', 'paidAt', 'paidById',
      'cancelledAt', 'cancelledById', 'payoutReference', 'paymentMethodNote',
      'failureReason', 'updatedAt'
    ]) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY[
      'status', 'approvedAt', 'approvedById', 'processingAt', 'paidAt', 'paidById',
      'cancelledAt', 'cancelledById', 'payoutReference', 'paymentMethodNote',
      'failureReason', 'updatedAt'
    ]) THEN
      RAISE EXCEPTION 'Approved PMS owner payout financial composition is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PmsOwnerPayoutBatch_financials_immutable" ON "PmsOwnerPayoutBatch";
CREATE TRIGGER "PmsOwnerPayoutBatch_financials_immutable"
BEFORE UPDATE ON "PmsOwnerPayoutBatch"
FOR EACH ROW EXECUTE FUNCTION pms_owner_payout_financials_immutable_after_draft();
