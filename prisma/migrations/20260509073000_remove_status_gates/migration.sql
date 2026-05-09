-- Remove human-approval gates on cards and match reports.
-- The AI is the ref; its decision is final.

-- Drop foreign keys for Card.approvedBy / dismissedBy (relation removed
-- on User side too).
ALTER TABLE "Card" DROP CONSTRAINT IF EXISTS "Card_approvedBy_fkey";
ALTER TABLE "Card" DROP CONSTRAINT IF EXISTS "Card_dismissedBy_fkey";

-- Drop the index on Card.status before dropping the column.
DROP INDEX IF EXISTS "Card_status_idx";
DROP INDEX IF EXISTS "MatchReport_status_idx";

-- Drop status + audit columns on Card.
ALTER TABLE "Card" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Card" DROP COLUMN IF EXISTS "approvedBy";
ALTER TABLE "Card" DROP COLUMN IF EXISTS "approvedAt";
ALTER TABLE "Card" DROP COLUMN IF EXISTS "dismissedBy";
ALTER TABLE "Card" DROP COLUMN IF EXISTS "dismissedAt";

-- Drop status + publishedAt on MatchReport.
ALTER TABLE "MatchReport" DROP COLUMN IF EXISTS "status";
ALTER TABLE "MatchReport" DROP COLUMN IF EXISTS "publishedAt";

-- Drop the now-unreferenced enum types.
DROP TYPE IF EXISTS "CardStatus";
DROP TYPE IF EXISTS "MatchReportStatus";
