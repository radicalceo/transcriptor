-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "audioPath" TEXT,
    "transcript" TEXT NOT NULL DEFAULT '[]',
    "transcriptSegments" TEXT NOT NULL DEFAULT '[]',
    "duration" INTEGER,
    "topics" TEXT NOT NULL DEFAULT '[]',
    "decisions" TEXT NOT NULL DEFAULT '[]',
    "actions" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Meeting_createdAt_idx" ON "Meeting"("createdAt");
