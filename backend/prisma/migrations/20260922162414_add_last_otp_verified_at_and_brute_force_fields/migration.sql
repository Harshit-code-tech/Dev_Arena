-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failed_login_locked_until" TIMESTAMP(3),
ADD COLUMN     "last_otp_verified_at" TIMESTAMP(3);
