CREATE TABLE "chat_identity_backups" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "public_key" JSONB NOT NULL,
  "encrypted_private_key" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "salt" TEXT NOT NULL,
  "kdf" TEXT NOT NULL DEFAULT 'PBKDF2-SHA256',
  "kdf_iterations" INTEGER NOT NULL DEFAULT 310000,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "backup_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_identity_backups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_devices" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "chat_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "player_matching_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "goal" TEXT NOT NULL DEFAULT 'Project teammate',
  "mode" TEXT NOT NULL DEFAULT 'Balanced',
  "preferred_domain" TEXT NOT NULL DEFAULT 'Any',
  "weekly_availability" TEXT NOT NULL DEFAULT 'Any',
  "experience_preference" TEXT NOT NULL DEFAULT 'Similar',
  "discovery_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "player_matching_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "player_match_feedback" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "model_version" TEXT NOT NULL DEFAULT 'tech-match-v1',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "player_match_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_identity_backups_user_id_key" ON "chat_identity_backups"("user_id");
CREATE UNIQUE INDEX "chat_devices_token_hash_key" ON "chat_devices"("token_hash");
CREATE INDEX "chat_devices_user_id_revoked_at_last_seen_at_idx" ON "chat_devices"("user_id", "revoked_at", "last_seen_at" DESC);
CREATE UNIQUE INDEX "player_matching_preferences_user_id_key" ON "player_matching_preferences"("user_id");
CREATE UNIQUE INDEX "player_match_feedback_user_id_candidate_id_key" ON "player_match_feedback"("user_id", "candidate_id");
CREATE INDEX "player_match_feedback_candidate_id_action_idx" ON "player_match_feedback"("candidate_id", "action");

ALTER TABLE "chat_identity_backups" ADD CONSTRAINT "chat_identity_backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_devices" ADD CONSTRAINT "chat_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_matching_preferences" ADD CONSTRAINT "player_matching_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_match_feedback" ADD CONSTRAINT "player_match_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_match_feedback" ADD CONSTRAINT "player_match_feedback_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
