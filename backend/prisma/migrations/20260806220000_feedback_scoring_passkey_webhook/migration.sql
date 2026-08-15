-- Decimal scoring supports Easy-problem diminishing returns and evidence-based project scores.
ALTER TABLE "users" ALTER COLUMN "arena_score" TYPE DOUBLE PRECISION USING "arena_score"::DOUBLE PRECISION;
ALTER TABLE "users" ALTER COLUMN "season_points" TYPE DOUBLE PRECISION USING "season_points"::DOUBLE PRECISION;
ALTER TABLE "score_events" ALTER COLUMN "points" TYPE DOUBLE PRECISION USING "points"::DOUBLE PRECISION;
ALTER TABLE "weekly_scores" ALTER COLUMN "dsa_points" TYPE DOUBLE PRECISION USING "dsa_points"::DOUBLE PRECISION;
ALTER TABLE "weekly_scores" ALTER COLUMN "fullstack_points" TYPE DOUBLE PRECISION USING "fullstack_points"::DOUBLE PRECISION;
ALTER TABLE "weekly_scores" ALTER COLUMN "project_points" TYPE DOUBLE PRECISION USING "project_points"::DOUBLE PRECISION;
ALTER TABLE "weekly_scores" ALTER COLUMN "practice_points" TYPE DOUBLE PRECISION USING "practice_points"::DOUBLE PRECISION;
ALTER TABLE "weekly_scores" ALTER COLUMN "general_points" TYPE DOUBLE PRECISION USING "general_points"::DOUBLE PRECISION;
ALTER TABLE "weekly_scores" ALTER COLUMN "challenge_points" TYPE DOUBLE PRECISION USING "challenge_points"::DOUBLE PRECISION;
ALTER TABLE "weekly_scores" ALTER COLUMN "total_score" TYPE DOUBLE PRECISION USING "total_score"::DOUBLE PRECISION;

ALTER TABLE "projects"
  ADD COLUMN "github_repository_size_kb" INTEGER,
  ADD COLUMN "github_source_bytes" DOUBLE PRECISION,
  ADD COLUMN "project_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "project_score_updated_at" TIMESTAMP(3),
  ADD COLUMN "project_score_version" TEXT;

CREATE TABLE "feedback_submissions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "feedback" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Open',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "feedback_submissions_user_id_created_at_idx" ON "feedback_submissions"("user_id", "created_at" DESC);
CREATE INDEX "feedback_submissions_feature_status_created_at_idx" ON "feedback_submissions"("feature", "status", "created_at" DESC);
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "chat_passkey_recoveries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "credential_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "encrypted_private_key" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "prf_salt" TEXT NOT NULL,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_used_at" TIMESTAMP(3),
  CONSTRAINT "chat_passkey_recoveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chat_passkey_recoveries_credential_id_key" ON "chat_passkey_recoveries"("credential_id");
CREATE INDEX "chat_passkey_recoveries_user_id_created_at_idx" ON "chat_passkey_recoveries"("user_id", "created_at" DESC);
ALTER TABLE "chat_passkey_recoveries" ADD CONSTRAINT "chat_passkey_recoveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "chat_device_transfers" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "request_code" TEXT NOT NULL,
  "request_public_key" JSONB NOT NULL,
  "encrypted_private_key" TEXT,
  "iv" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "approved_at" TIMESTAMP(3),
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_device_transfers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chat_device_transfers_request_code_key" ON "chat_device_transfers"("request_code");
CREATE INDEX "chat_device_transfers_user_id_expires_at_idx" ON "chat_device_transfers"("user_id", "expires_at");
ALTER TABLE "chat_device_transfers" ADD CONSTRAINT "chat_device_transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "github_webhook_deliveries" (
  "id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "action" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Accepted',
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "github_webhook_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "github_webhook_deliveries_delivery_id_key" ON "github_webhook_deliveries"("delivery_id");
CREATE INDEX "github_webhook_deliveries_received_at_idx" ON "github_webhook_deliveries"("received_at" DESC);

CREATE TABLE "github_project_refresh_jobs" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "github_project_refresh_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "github_project_refresh_jobs_project_id_key" ON "github_project_refresh_jobs"("project_id");
CREATE INDEX "github_project_refresh_jobs_due_at_locked_at_idx" ON "github_project_refresh_jobs"("due_at", "locked_at");
ALTER TABLE "github_project_refresh_jobs" ADD CONSTRAINT "github_project_refresh_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
