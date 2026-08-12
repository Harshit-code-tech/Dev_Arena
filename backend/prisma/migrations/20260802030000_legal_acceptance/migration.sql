-- Record versioned acceptance for new DevArena accounts.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "terms_version" TEXT,
  ADD COLUMN IF NOT EXISTS "privacy_version" TEXT;
