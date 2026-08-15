-- Baseline migration for user/auth/stat columns that already exist in the
-- current Neon database but were previously created outside Prisma Migrate.
--
-- On the existing database, mark this migration as applied with:
--   npx prisma migrate resolve --applied 20260531090000_sync_existing_user_auth_stats
--
-- On a fresh database, Prisma will execute this SQL normally.

ALTER TABLE "users"
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ADD COLUMN "active_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "arena_score" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "is_two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rank" TEXT NOT NULL DEFAULT 'Unranked',
  ADD COLUMN "season_bonus_claimed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "season_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "season_points" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "season_start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "streak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "two_factor_color_sequence" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "weekly_bonus_claimed" BOOLEAN NOT NULL DEFAULT false;

-- Prisma schema does not define a database default for this required list.
-- The temporary default above safely backfills existing rows on fresh databases.
ALTER TABLE "users"
  ALTER COLUMN "two_factor_color_sequence" DROP DEFAULT;
