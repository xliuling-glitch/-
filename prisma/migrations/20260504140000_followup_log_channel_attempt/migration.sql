-- AlterTable FollowupLog
ALTER TABLE "FollowupLog" ADD COLUMN "channel" TEXT NOT NULL DEFAULT '微信';
ALTER TABLE "FollowupLog" ADD COLUMN "channelNote" TEXT;
ALTER TABLE "FollowupLog" ADD COLUMN "attemptNo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FollowupLog" ADD COLUMN "followedAt" DATETIME;
UPDATE "FollowupLog" SET "followedAt" = "createdAt" WHERE "followedAt" IS NULL;
