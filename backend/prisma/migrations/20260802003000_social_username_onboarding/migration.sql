ALTER TABLE "users"
ADD COLUMN "username_chosen" BOOLEAN NOT NULL DEFAULT true;

-- Existing passwordless accounts were created through Google or GitHub and
-- must confirm their own permanent username on their next sign-in.
UPDATE "users"
SET "username_chosen" = false
WHERE "password_hash" IS NULL;
