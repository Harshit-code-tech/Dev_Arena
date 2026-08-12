CREATE TYPE "UserRole" AS ENUM ('User', 'Admin', 'Judge', 'Moderator');
CREATE TYPE "TournamentType" AS ENUM ('DSA', 'Project');
CREATE TYPE "TournamentMode" AS ENUM ('Solo', 'Team', 'Both');
CREATE TYPE "TournamentStatus" AS ENUM ('Draft', 'Published', 'Registration_Open', 'Live', 'Judging', 'Completed', 'Cancelled');
CREATE TYPE "TournamentRegistrationStatus" AS ENUM ('Registered', 'Matched', 'Withdrawn', 'Disqualified', 'Completed');
CREATE TYPE "TournamentSubmissionStatus" AS ENUM ('Draft', 'Submitted', 'Queued', 'Running', 'Accepted', 'Wrong_Answer', 'Time_Limit_Exceeded', 'Memory_Limit_Exceeded', 'Runtime_Error', 'Compilation_Error', 'Under_Review', 'Scored', 'Disqualified');

ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'User';

CREATE TABLE "tournaments" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "rules" TEXT NOT NULL,
  "type" "TournamentType" NOT NULL,
  "mode" "TournamentMode" NOT NULL,
  "status" "TournamentStatus" NOT NULL DEFAULT 'Draft',
  "difficulty" TEXT NOT NULL DEFAULT 'Mixed',
  "registration_opens_at" TIMESTAMP(3) NOT NULL,
  "registration_closes_at" TIMESTAMP(3) NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "leaderboard_freezes_at" TIMESTAMP(3),
  "leaderboard_frozen_at" TIMESTAMP(3),
  "frozen_leaderboard" JSONB,
  "results_published_at" TIMESTAMP(3),
  "team_size_min" INTEGER NOT NULL DEFAULT 1,
  "team_size_max" INTEGER NOT NULL DEFAULT 1,
  "max_participants" INTEGER,
  "allowed_languages" TEXT[] NOT NULL,
  "theme" TEXT,
  "required_features" TEXT,
  "submission_checklist" TEXT,
  "require_deployment" BOOLEAN NOT NULL DEFAULT false,
  "first_place_points" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "second_place_points" DOUBLE PRECISION NOT NULL DEFAULT 70,
  "third_place_points" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "top_ten_percent_points" DOUBLE PRECISION NOT NULL DEFAULT 25,
  "participation_points" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");
CREATE INDEX "tournaments_status_starts_at_idx" ON "tournaments"("status", "starts_at");
CREATE INDEX "tournaments_type_status_starts_at_idx" ON "tournaments"("type", "status", "starts_at");

CREATE TABLE "tournament_questions" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "statement" TEXT NOT NULL,
  "input_format" TEXT,
  "output_format" TEXT,
  "constraints" TEXT,
  "examples" JSONB,
  "visible_test_cases" JSONB,
  "hidden_test_cases" JSONB,
  "official_solution" TEXT,
  "explanation" TEXT,
  "difficulty" "Difficulty" NOT NULL,
  "points" INTEGER NOT NULL,
  "time_limit_ms" INTEGER NOT NULL DEFAULT 2000,
  "memory_limit_mb" INTEGER NOT NULL DEFAULT 256,
  "allowed_languages" TEXT[] NOT NULL,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tournament_questions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tournament_questions_tournament_id_slug_key" ON "tournament_questions"("tournament_id", "slug");
CREATE INDEX "tournament_questions_tournament_id_order_index_idx" ON "tournament_questions"("tournament_id", "order_index");

CREATE TABLE "tournament_teams" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "join_code" TEXT NOT NULL,
  "matching_score" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'Forming',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tournament_teams_join_code_key" ON "tournament_teams"("join_code");
CREATE INDEX "tournament_teams_tournament_id_status_idx" ON "tournament_teams"("tournament_id", "status");

CREATE TABLE "tournament_registrations" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "participation_mode" TEXT NOT NULL DEFAULT 'Solo',
  "status" "TournamentRegistrationStatus" NOT NULL DEFAULT 'Registered',
  "team_id" TEXT,
  "preferred_role" TEXT,
  "availability" TEXT,
  "final_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "final_rank" INTEGER,
  "arena_points_awarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tournament_registrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tournament_registrations_tournament_id_user_id_key" ON "tournament_registrations"("tournament_id", "user_id");
CREATE INDEX "tournament_registrations_tournament_id_status_final_score_idx" ON "tournament_registrations"("tournament_id", "status", "final_score" DESC);
CREATE INDEX "tournament_registrations_team_id_idx" ON "tournament_registrations"("team_id");

CREATE TABLE "tournament_team_members" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_team_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tournament_team_members_team_id_user_id_key" ON "tournament_team_members"("team_id", "user_id");
CREATE INDEX "tournament_team_members_user_id_joined_at_idx" ON "tournament_team_members"("user_id", "joined_at" DESC);

CREATE TABLE "dsa_tournament_submissions" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "TournamentSubmissionStatus" NOT NULL DEFAULT 'Queued',
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "passed_tests" INTEGER NOT NULL DEFAULT 0,
  "total_tests" INTEGER NOT NULL DEFAULT 0,
  "execution_time_ms" INTEGER,
  "memory_used_kb" INTEGER,
  "penalty_minutes" INTEGER NOT NULL DEFAULT 0,
  "judge_output" TEXT,
  "admin_notes" TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dsa_tournament_submissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "dsa_tournament_submissions_tournament_id_user_id_submitted_at_idx" ON "dsa_tournament_submissions"("tournament_id", "user_id", "submitted_at" DESC);
CREATE INDEX "dsa_tournament_submissions_question_id_score_submitted_at_idx" ON "dsa_tournament_submissions"("question_id", "score" DESC, "submitted_at");

CREATE TABLE "project_tournament_submissions" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "user_id" TEXT,
  "team_id" TEXT,
  "repository_url" TEXT NOT NULL,
  "repository_id" TEXT,
  "repository_full_name" TEXT,
  "repository_private" BOOLEAN,
  "baseline_commit_sha" TEXT,
  "final_commit_sha" TEXT,
  "baseline_source_bytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "final_source_bytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "baseline_repository_size_kb" INTEGER NOT NULL DEFAULT 0,
  "final_repository_size_kb" INTEGER NOT NULL DEFAULT 0,
  "language_bytes" JSONB,
  "languages" JSONB,
  "contribution_weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contribution_status" TEXT,
  "member_contribution_weights" JSONB,
  "deployment_url" TEXT,
  "demo_video_url" TEXT,
  "notes" TEXT,
  "status" "TournamentSubmissionStatus" NOT NULL DEFAULT 'Draft',
  "automated_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "manual_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "final_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rubric_scores" JSONB,
  "admin_notes" TEXT,
  "baseline_captured_at" TIMESTAMP(3),
  "submitted_at" TIMESTAMP(3),
  "last_github_refresh_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_tournament_submissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_tournament_submissions_tournament_id_final_score_submitted_at_idx" ON "project_tournament_submissions"("tournament_id", "final_score" DESC, "submitted_at");
CREATE INDEX "project_tournament_submissions_user_id_tournament_id_idx" ON "project_tournament_submissions"("user_id", "tournament_id");
CREATE INDEX "project_tournament_submissions_team_id_tournament_id_idx" ON "project_tournament_submissions"("team_id", "tournament_id");
CREATE INDEX "project_tournament_submissions_repository_id_idx" ON "project_tournament_submissions"("repository_id");
CREATE INDEX "project_tournament_submissions_repository_full_name_idx" ON "project_tournament_submissions"("repository_full_name");

CREATE TABLE "tournament_project_refresh_jobs" (
  "id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tournament_project_refresh_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tournament_project_refresh_jobs_submission_id_key" ON "tournament_project_refresh_jobs"("submission_id");
CREATE INDEX "tournament_project_refresh_jobs_due_at_locked_at_idx" ON "tournament_project_refresh_jobs"("due_at", "locked_at");

CREATE TABLE "tournament_announcements" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tournament_announcements_tournament_id_created_at_idx" ON "tournament_announcements"("tournament_id", "created_at" DESC);

CREATE TABLE "user_presence" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "route" TEXT,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_presence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_presence_user_id_key" ON "user_presence"("user_id");
CREATE INDEX "user_presence_last_seen_at_idx" ON "user_presence"("last_seen_at" DESC);
CREATE INDEX "user_presence_route_last_seen_at_idx" ON "user_presence"("route", "last_seen_at" DESC);

CREATE TABLE "presence_snapshots" (
  "id" TEXT NOT NULL,
  "bucket_at" TIMESTAMP(3) NOT NULL,
  "online_count" INTEGER NOT NULL,
  "tournament_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "presence_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "presence_snapshots_bucket_at_tournament_id_key" ON "presence_snapshots"("bucket_at", "tournament_id");
CREATE INDEX "presence_snapshots_bucket_at_idx" ON "presence_snapshots"("bucket_at" DESC);

CREATE TABLE "admin_audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_audit_logs_actor_id_created_at_idx" ON "admin_audit_logs"("actor_id", "created_at" DESC);
CREATE INDEX "admin_audit_logs_entity_type_entity_id_created_at_idx" ON "admin_audit_logs"("entity_type", "entity_id", "created_at" DESC);

ALTER TABLE "tournament_questions" ADD CONSTRAINT "tournament_questions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournament_team_members" ADD CONSTRAINT "tournament_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_team_members" ADD CONSTRAINT "tournament_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dsa_tournament_submissions" ADD CONSTRAINT "dsa_tournament_submissions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dsa_tournament_submissions" ADD CONSTRAINT "dsa_tournament_submissions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "tournament_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dsa_tournament_submissions" ADD CONSTRAINT "dsa_tournament_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_tournament_submissions" ADD CONSTRAINT "project_tournament_submissions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_tournament_submissions" ADD CONSTRAINT "project_tournament_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_tournament_submissions" ADD CONSTRAINT "project_tournament_submissions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_project_refresh_jobs" ADD CONSTRAINT "tournament_project_refresh_jobs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "project_tournament_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_announcements" ADD CONSTRAINT "tournament_announcements_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_announcements" ADD CONSTRAINT "tournament_announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presence_snapshots" ADD CONSTRAINT "presence_snapshots_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
