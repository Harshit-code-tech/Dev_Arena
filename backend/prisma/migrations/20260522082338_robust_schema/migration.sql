-- ─────────────────────────────────────────────────────────────────────────────
-- robust_schema migration
--
-- Key fix: instead of DROP + ADD (which destroys data), we:
--   1. Create enum types
--   2. Use ALTER COLUMN ... TYPE ... USING col::text::EnumType
--      This casts existing text values directly into the enum.
--   3. For new NOT NULL updated_at columns on tables that may have data,
--      we add with a DEFAULT first, then remove the default — so existing
--      rows get a sensible timestamp instead of erroring.
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('Easy', 'Medium', 'Hard');

-- CreateEnum
CREATE TYPE "FullstackType" AS ENUM ('Learning', 'Building');

-- CreateEnum
CREATE TYPE "PracticeType" AS ENUM ('DSA_Revision', 'Concept_Explanation');

-- CreateEnum
CREATE TYPE "ProjectDomain" AS ENUM ('Fullstack', 'App', 'AI', 'Other');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('In_Progress', 'Completed');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('Pending', 'Completed');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('reminder', 'summary', 'challenge', 'system');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('DSA', 'Fullstack', 'Project', 'Consistency');

-- ─────────────────────────────────────────────────────────────────────────────
-- achievements: category TEXT → AchievementCategory enum
-- (table has seeded data, so we MUST use USING cast instead of DROP/ADD)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "achievements"
  ALTER COLUMN "category" TYPE "AchievementCategory"
  USING "category"::"AchievementCategory";

-- ─────────────────────────────────────────────────────────────────────────────
-- activity: date timestamp → date only
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "activity"
  ALTER COLUMN "date" SET DATA TYPE DATE;

-- ─────────────────────────────────────────────────────────────────────────────
-- challenge_results: week_start timestamp → date only
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "challenge_results"
  ALTER COLUMN "week_start" SET DATA TYPE DATE;

-- ─────────────────────────────────────────────────────────────────────────────
-- dsa_logs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "dsa_logs"
  ALTER COLUMN "difficulty" TYPE "Difficulty" USING "difficulty"::"Difficulty";

-- Add updated_at with a temporary default so existing rows get a value
ALTER TABLE "dsa_logs"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
-- Remove the default (Prisma manages this via @updatedAt at app level)
ALTER TABLE "dsa_logs"
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────────
-- fullstack_logs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "fullstack_logs"
  ALTER COLUMN "type" TYPE "FullstackType" USING "type"::"FullstackType";

ALTER TABLE "fullstack_logs"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "fullstack_logs"
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────────
-- milestones
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "milestones"
  ALTER COLUMN "status" TYPE "MilestoneStatus" USING "status"::"MilestoneStatus";

ALTER TABLE "milestones"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "milestones"
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "NotificationType" USING "type"::"NotificationType";

-- ─────────────────────────────────────────────────────────────────────────────
-- practice_logs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "practice_logs"
  ALTER COLUMN "type" TYPE "PracticeType" USING "type"::"PracticeType";

ALTER TABLE "practice_logs"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "practice_logs"
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────────
-- project_logs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "project_logs"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "project_logs"
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────────
-- projects
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "projects"
  ALTER COLUMN "domain" TYPE "ProjectDomain" USING "domain"::"ProjectDomain",
  ALTER COLUMN "status" TYPE "ProjectStatus" USING "status"::"ProjectStatus";

ALTER TABLE "projects"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "projects"
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────────
-- weekly_scores
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "weekly_scores"
  ALTER COLUMN "week_start" SET DATA TYPE DATE;

ALTER TABLE "weekly_scores"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "weekly_scores"
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX "activity_user_id_date_idx"                    ON "activity"("user_id", "date" DESC);
CREATE INDEX "challenge_results_week_start_score_idx"       ON "challenge_results"("week_start", "score" DESC);
CREATE INDEX "dsa_logs_user_id_created_at_idx"              ON "dsa_logs"("user_id", "created_at" DESC);
CREATE INDEX "fullstack_logs_user_id_created_at_idx"        ON "fullstack_logs"("user_id", "created_at" DESC);
CREATE INDEX "milestones_project_id_status_idx"             ON "milestones"("project_id", "status");
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);
CREATE INDEX "practice_logs_user_id_created_at_idx"         ON "practice_logs"("user_id", "created_at" DESC);
CREATE INDEX "project_logs_project_id_created_at_idx"       ON "project_logs"("project_id", "created_at" DESC);
CREATE INDEX "projects_user_id_status_idx"                  ON "projects"("user_id", "status");
CREATE INDEX "user_achievements_user_id_unlocked_at_idx"    ON "user_achievements"("user_id", "unlocked_at" DESC);
CREATE INDEX "weekly_scores_week_start_total_score_idx"     ON "weekly_scores"("week_start", "total_score" DESC);
