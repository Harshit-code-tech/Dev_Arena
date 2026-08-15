-- Existing DevArena accounts remain unaffected. Only accounts created after
-- this release are marked as requiring the username + GitHub onboarding flow.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "onboarding_required" BOOLEAN NOT NULL DEFAULT false;
