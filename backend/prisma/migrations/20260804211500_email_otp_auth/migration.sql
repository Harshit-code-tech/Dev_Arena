-- Remove the legacy colour-based two-factor authentication columns.
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "is_two_factor_enabled",
  DROP COLUMN IF EXISTS "two_factor_color_sequence";

-- OTP purpose is deliberately limited to the two authentication flows that
-- require a challenge before an authenticated session is issued.
DO $$
BEGIN
  CREATE TYPE "AuthOtpPurpose" AS ENUM ('Signup', 'Login');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "auth_otp_challenges" (
  "id" TEXT NOT NULL,
  "purpose" "AuthOtpPurpose" NOT NULL,
  "email" TEXT NOT NULL,
  "user_id" TEXT,
  "pending_name" TEXT,
  "pending_password_hash" TEXT,
  "otp_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "resend_available_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "remember_session" BOOLEAN NOT NULL DEFAULT false,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_otp_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_otp_challenges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "auth_otp_challenges_email_purpose_created_at_idx"
  ON "auth_otp_challenges"("email", "purpose", "created_at");

CREATE INDEX IF NOT EXISTS "auth_otp_challenges_user_id_purpose_created_at_idx"
  ON "auth_otp_challenges"("user_id", "purpose", "created_at");
