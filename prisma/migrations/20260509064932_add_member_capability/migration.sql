-- CreateTable
CREATE TABLE "MemberCapability" (
    "id" TEXT NOT NULL,
    "projectMemberId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberCapability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberCapability_projectMemberId_idx" ON "MemberCapability"("projectMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberCapability_projectMemberId_capability_key" ON "MemberCapability"("projectMemberId", "capability");

-- AddForeignKey
ALTER TABLE "MemberCapability" ADD CONSTRAINT "MemberCapability_projectMemberId_fkey" FOREIGN KEY ("projectMemberId") REFERENCES "ProjectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
