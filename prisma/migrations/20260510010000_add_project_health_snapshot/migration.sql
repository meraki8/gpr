-- Project-level health-score snapshots, written after each transcript
-- analysis so the overview can show "X since last meeting" without
-- replaying the historical formula.
CREATE TABLE "ProjectHealthSnapshot" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "matchReportId" TEXT,
  "reason" TEXT NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- One snapshot per match report at most. Snapshots taken outside an
-- analysis (matchReportId = NULL) don't conflict with this constraint.
CREATE UNIQUE INDEX "ProjectHealthSnapshot_matchReportId_key"
  ON "ProjectHealthSnapshot"("matchReportId");

CREATE INDEX "ProjectHealthSnapshot_projectId_computedAt_idx"
  ON "ProjectHealthSnapshot"("projectId", "computedAt");
