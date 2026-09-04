-- DropIndex
DROP INDEX "challenge_results_week_start_score_idx";

-- AlterTable
ALTER TABLE "challenge_results" ADD COLUMN     "correctness" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "efficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "score" SET DEFAULT 0,
ALTER COLUMN "score" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "challenge_results_week_start_score_correctness_idx" ON "challenge_results"("week_start", "score" DESC, "correctness" DESC);

-- RenameIndex
ALTER INDEX "dsa_tournament_submissions_tournament_id_user_id_submitted_at_i" RENAME TO "dsa_tournament_submissions_tournament_id_user_id_submitted__idx";

-- RenameIndex
ALTER INDEX "github_authorized_repositories_installation_access_id_full_name" RENAME TO "github_authorized_repositories_installation_access_id_full__idx";

-- RenameIndex
ALTER INDEX "project_tournament_submissions_tournament_id_final_score_submit" RENAME TO "project_tournament_submissions_tournament_id_final_score_su_idx";
