-- CreateEnum
CREATE TYPE "MilestoneSize" AS ENUM ('Minor', 'Major', 'Release');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('Draft', 'Active', 'Evaluating', 'Completed');

-- CreateEnum
CREATE TYPE "CompetitionTaskType" AS ENUM ('DSA', 'Development', 'Debugging');

-- CreateEnum
CREATE TYPE "CompetitionSubmissionStatus" AS ENUM ('Pending', 'Evaluating', 'Passed', 'Partial', 'Failed', 'Error');

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "size" "MilestoneSize" NOT NULL DEFAULT 'Minor';

-- CreateTable
CREATE TABLE "weekly_competitions" (
    "id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'Draft',
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_tasks" (
    "id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "type" "CompetitionTaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "input_constraints" TEXT,
    "expected_time" TEXT,
    "expected_space" TEXT,
    "accepted_time_tiers" JSONB,
    "memory_limit_mb" INTEGER,
    "time_limit_ms" INTEGER,
    "correctness_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
    "efficiency_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "time_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "weight_percentage" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_test_cases" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expected_output" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "competition_test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_submissions" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "CompetitionSubmissionStatus" NOT NULL DEFAULT 'Pending',
    "correctness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completion_time" INTEGER NOT NULL DEFAULT 0,
    "tests_passed" INTEGER NOT NULL DEFAULT 0,
    "tests_total" INTEGER NOT NULL DEFAULT 0,
    "evaluation_log" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluated_at" TIMESTAMP(3),

    CONSTRAINT "competition_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_competitions_week_start_key" ON "weekly_competitions"("week_start");

-- CreateIndex
CREATE INDEX "weekly_competitions_status_week_start_idx" ON "weekly_competitions"("status", "week_start" DESC);

-- CreateIndex
CREATE INDEX "competition_tasks_competition_id_sort_order_idx" ON "competition_tasks"("competition_id", "sort_order");

-- CreateIndex
CREATE INDEX "competition_test_cases_task_id_idx" ON "competition_test_cases"("task_id");

-- CreateIndex
CREATE INDEX "competition_submissions_user_id_submitted_at_idx" ON "competition_submissions"("user_id", "submitted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "competition_submissions_task_id_user_id_key" ON "competition_submissions"("task_id", "user_id");

-- AddForeignKey
ALTER TABLE "competition_tasks" ADD CONSTRAINT "competition_tasks_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "weekly_competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_test_cases" ADD CONSTRAINT "competition_test_cases_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "competition_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "competition_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
