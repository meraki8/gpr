-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRefId" TEXT,
    "sourceTypeLabel" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntry_projectId_source_sourceRefId_key" ON "KnowledgeEntry"("projectId", "source", "sourceRefId");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_projectId_createdAt_idx" ON "KnowledgeEntry"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_projectId_source_idx" ON "KnowledgeEntry"("projectId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntry_projectId_source_sourceRefId_key" ON "KnowledgeEntry"("projectId", "source", "sourceRefId");

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
