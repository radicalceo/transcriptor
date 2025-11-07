-- Migrate existing 'live' meetings to 'audio-only'
UPDATE "Meeting" SET "type" = 'audio-only' WHERE "type" = 'live';

-- AlterTable
ALTER TABLE "Meeting" ALTER COLUMN "type" SET DEFAULT 'audio-only';
