-- AlterEnum: add JIRA variants. The DB already has these (someone added
-- them out-of-band before this migration was authored); this migration
-- exists to re-align the migration history with the current DB state.
-- Marked applied via `prisma migrate resolve --applied`.
ALTER TYPE "ContributionSourceType" ADD VALUE IF NOT EXISTS 'JIRA';
ALTER TYPE "TaskSource" ADD VALUE IF NOT EXISTS 'JIRA';
