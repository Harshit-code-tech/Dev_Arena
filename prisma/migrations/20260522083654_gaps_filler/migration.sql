/*
  Warnings:

  - A unique constraint covering the columns `[user_id,url]` on the table `dsa_logs` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "weekly_scores_week_start_total_score_idx";

-- AlterTable
ALTER TABLE "challenge_results" ADD COLUMN     "submission_link" TEXT;

-- AlterTable
ALTER TABLE "milestones" ALTER COLUMN "status" SET DEFAULT 'Pending';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "link" TEXT;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'In_Progress';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "email_otp" TEXT,
ADD COLUMN     "email_otp_expires_at" TIMESTAMP(3),
ADD COLUMN     "github_url" TEXT,
ADD COLUMN     "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedin_url" TEXT,
ADD COLUMN     "password_reset_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT,
ADD COLUMN     "portfolio_url" TEXT;

-- AlterTable
ALTER TABLE "weekly_scores" ADD COLUMN     "active_days" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "dsa_logs_user_id_url_key" ON "dsa_logs"("user_id", "url");

-- CreateIndex
CREATE INDEX "weekly_scores_week_start_total_score_active_days_idx" ON "weekly_scores"("week_start", "total_score" DESC, "active_days" DESC);
