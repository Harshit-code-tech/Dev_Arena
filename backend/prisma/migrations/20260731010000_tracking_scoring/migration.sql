-- Structured tracking dates and auditable scoring events.
CREATE TYPE "ScoreCategory" AS ENUM ('DSA', 'Fullstack', 'Project', 'Practice', 'General', 'Challenge');
CREATE TYPE "FullstackCategory" AS ENUM ('Course_Progress', 'Practical_Work');

ALTER TABLE "dsa_logs"
ADD COLUMN "activity_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "fullstack_logs"
ADD COLUMN "category" "FullstackCategory" NOT NULL DEFAULT 'Practical_Work',
ADD COLUMN "activity_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "project_logs"
ADD COLUMN "activity_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "practice_logs"
ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Practice session',
ADD COLUMN "time_spent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "proof_link" TEXT,
ADD COLUMN "activity_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "weekly_scores"
ADD COLUMN "general_points" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "projects"
ADD COLUMN "completion_awarded_at" TIMESTAMP(3);

ALTER TABLE "milestones"
ADD COLUMN "completion_awarded_at" TIMESTAMP(3);

CREATE TABLE "score_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "category" "ScoreCategory" NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "score_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "score_events_user_id_source_type_source_id_key"
ON "score_events"("user_id", "source_type", "source_id");

CREATE INDEX "score_events_user_id_occurred_at_idx"
ON "score_events"("user_id", "occurred_at" DESC);

CREATE INDEX "score_events_user_id_category_occurred_at_idx"
ON "score_events"("user_id", "category", "occurred_at" DESC);

ALTER TABLE "score_events"
ADD CONSTRAINT "score_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the original activity dates for rows created before this migration.
UPDATE "dsa_logs" SET "activity_date" = "created_at";
UPDATE "fullstack_logs"
SET "activity_date" = "created_at",
    "category" = CASE
      WHEN "type" = 'Learning' THEN 'Course_Progress'::"FullstackCategory"
      ELSE 'Practical_Work'::"FullstackCategory"
    END;
UPDATE "project_logs" SET "activity_date" = "created_at";
UPDATE "practice_logs" SET "activity_date" = "created_at";
UPDATE "projects" SET "completion_awarded_at" = "updated_at" WHERE "status" = 'Completed';
UPDATE "milestones" SET "completion_awarded_at" = "updated_at" WHERE "status" = 'Completed';

-- Backfill auditable score events for existing structured activity.
INSERT INTO "score_events" (
  "id", "user_id", "category", "source_type", "source_id", "label", "points", "occurred_at", "created_at", "updated_at"
)
SELECT
  'dsa-' || "id", "user_id", 'DSA'::"ScoreCategory", 'DSA_LOG', "id", 'DSA: ' || "problem_name",
  CASE "difficulty" WHEN 'Easy' THEN 1 WHEN 'Medium' THEN 3 ELSE 5 END,
  "activity_date", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "dsa_logs"
ON CONFLICT ("user_id", "source_type", "source_id") DO NOTHING;

INSERT INTO "score_events" (
  "id", "user_id", "category", "source_type", "source_id", "label", "points", "occurred_at", "created_at", "updated_at"
)
SELECT
  'fullstack-' || "id", "user_id", 'Fullstack'::"ScoreCategory", 'FULLSTACK_LOG', "id", "type"::text || ': ' || "title",
  CASE "type" WHEN 'Learning' THEN 2 ELSE 4 END,
  "activity_date", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "fullstack_logs"
ON CONFLICT ("user_id", "source_type", "source_id") DO NOTHING;

INSERT INTO "score_events" (
  "id", "user_id", "category", "source_type", "source_id", "label", "points", "occurred_at", "created_at", "updated_at"
)
SELECT
  'practice-' || "id", "user_id", 'Practice'::"ScoreCategory", 'PRACTICE_LOG', "id", 'Practice: ' || "title",
  CASE "type" WHEN 'DSA_Revision' THEN 2 ELSE 3 END,
  "activity_date", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "practice_logs"
ON CONFLICT ("user_id", "source_type", "source_id") DO NOTHING;

INSERT INTO "score_events" (
  "id", "user_id", "category", "source_type", "source_id", "label", "points", "occurred_at", "created_at", "updated_at"
)
SELECT
  'project-log-' || pl."id", pl."user_id", 'Project'::"ScoreCategory", 'PROJECT_LOG', pl."id", 'Project: ' || p."title" || ' — ' || pl."description",
  3, pl."activity_date", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "project_logs" pl
JOIN "projects" p ON p."id" = pl."project_id"
ON CONFLICT ("user_id", "source_type", "source_id") DO NOTHING;

INSERT INTO "score_events" (
  "id", "user_id", "category", "source_type", "source_id", "label", "points", "occurred_at", "created_at", "updated_at"
)
SELECT
  'milestone-' || m."id", p."user_id", 'Project'::"ScoreCategory", 'MILESTONE_COMPLETED', m."id", 'Milestone completed: ' || p."title" || ' — ' || m."title",
  8, m."completion_awarded_at", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "milestones" m
JOIN "projects" p ON p."id" = m."project_id"
WHERE m."status" = 'Completed'
ON CONFLICT ("user_id", "source_type", "source_id") DO NOTHING;

INSERT INTO "score_events" (
  "id", "user_id", "category", "source_type", "source_id", "label", "points", "occurred_at", "created_at", "updated_at"
)
SELECT
  'project-complete-' || "id", "user_id", 'Project'::"ScoreCategory", 'PROJECT_COMPLETED', "id", 'Project completed: ' || "title",
  20, "completion_awarded_at", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "projects"
WHERE "status" = 'Completed'
ON CONFLICT ("user_id", "source_type", "source_id") DO NOTHING;
