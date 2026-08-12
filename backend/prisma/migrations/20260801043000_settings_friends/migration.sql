-- DevArena profile settings, permanent usernames, and friend network.
CREATE TYPE "FriendRequestStatus" AS ENUM ('Pending', 'Declined');
CREATE TYPE "EmailInviteStatus" AS ENUM ('Pending', 'Accepted', 'Expired');

ALTER TABLE "users"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "use_initials" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "activity_reminders" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "privacy_mode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "compact_workspace" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "friend_request_emails" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "login_otp_emails" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "streak_reminder_emails" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "challenge_notifications" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "in_app_notifications" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pending_name" TEXT,
  ADD COLUMN "pending_email" TEXT,
  ADD COLUMN "profile_change_otp" TEXT,
  ADD COLUMN "profile_change_otp_expires_at" TIMESTAMP(3);

UPDATE "users"
SET "username" =
  CASE
    WHEN regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9_]+', '', 'g') = ''
      THEN 'developer'
    ELSE regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9_]+', '', 'g')
  END || '_' || substring(replace("id", '-', '') from 1 for 6)
WHERE "username" IS NULL;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

CREATE TABLE "friend_requests" (
  "id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "receiver_id" TEXT NOT NULL,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'Pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "friendships" (
  "id" TEXT NOT NULL,
  "user_a_id" TEXT NOT NULL,
  "user_b_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_invites" (
  "id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" "EmailInviteStatus" NOT NULL DEFAULT 'Pending',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "friend_requests_sender_id_receiver_id_key" ON "friend_requests"("sender_id", "receiver_id");
CREATE INDEX "friend_requests_receiver_id_status_created_at_idx" ON "friend_requests"("receiver_id", "status", "created_at" DESC);
CREATE INDEX "friend_requests_sender_id_status_created_at_idx" ON "friend_requests"("sender_id", "status", "created_at" DESC);
CREATE UNIQUE INDEX "friendships_user_a_id_user_b_id_key" ON "friendships"("user_a_id", "user_b_id");
CREATE INDEX "friendships_user_a_id_created_at_idx" ON "friendships"("user_a_id", "created_at" DESC);
CREATE INDEX "friendships_user_b_id_created_at_idx" ON "friendships"("user_b_id", "created_at" DESC);
CREATE UNIQUE INDEX "email_invites_token_key" ON "email_invites"("token");
CREATE UNIQUE INDEX "email_invites_sender_id_email_key" ON "email_invites"("sender_id", "email");
CREATE INDEX "email_invites_email_status_idx" ON "email_invites"("email", "status");

ALTER TABLE "friend_requests"
  ADD CONSTRAINT "friend_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "friend_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "friendships"
  ADD CONSTRAINT "friendships_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "friendships_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_invites"
  ADD CONSTRAINT "email_invites_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
