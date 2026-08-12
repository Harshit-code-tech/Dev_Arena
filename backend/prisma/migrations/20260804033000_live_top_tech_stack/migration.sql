ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "top_tech_stack" JSONB,
  ADD COLUMN IF NOT EXISTS "top_tech_stack_updated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "top_tech_stack_project_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "github_language_bytes" JSONB,
  ADD COLUMN IF NOT EXISTS "github_is_fork" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "github_parent_full_name" TEXT,
  ADD COLUMN IF NOT EXISTS "github_contribution_status" TEXT,
  ADD COLUMN IF NOT EXISTS "github_contributor_commits" INTEGER,
  ADD COLUMN IF NOT EXISTS "github_repository_commits" INTEGER,
  ADD COLUMN IF NOT EXISTS "github_user_additions" INTEGER,
  ADD COLUMN IF NOT EXISTS "github_user_deletions" INTEGER,
  ADD COLUMN IF NOT EXISTS "github_contribution_percent" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "github_contribution_weight" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "github_contribution_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "github_eligible_for_tech_stack" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "github_eligibility_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "github_verification_version" TEXT;

CREATE INDEX IF NOT EXISTS "projects_user_id_github_eligible_for_tech_stack_idx"
  ON "projects"("user_id", "github_eligible_for_tech_stack");
