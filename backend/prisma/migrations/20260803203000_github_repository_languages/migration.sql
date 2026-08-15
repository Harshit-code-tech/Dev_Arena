-- GitHub App connection and verified repository-language evidence.
-- Existing projects remain valid; GitHub verification is required by the application for new projects.

CREATE TABLE "github_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "github_user_id" TEXT,
    "github_login" TEXT,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "oauth_state_hash" TEXT,
    "oauth_state_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "github_connections_user_id_key" ON "github_connections"("user_id");
CREATE UNIQUE INDEX "github_connections_oauth_state_hash_key" ON "github_connections"("oauth_state_hash");

ALTER TABLE "github_connections"
ADD CONSTRAINT "github_connections_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projects"
ADD COLUMN "github_repository_url" TEXT,
ADD COLUMN "github_repository_id" TEXT,
ADD COLUMN "github_repository_owner" TEXT,
ADD COLUMN "github_repository_name" TEXT,
ADD COLUMN "github_repository_full_name" TEXT,
ADD COLUMN "github_repository_private" BOOLEAN,
ADD COLUMN "github_repository_default_branch" TEXT,
ADD COLUMN "github_installation_id" TEXT,
ADD COLUMN "github_permission" TEXT,
ADD COLUMN "github_languages" JSONB,
ADD COLUMN "github_languages_fetched_at" TIMESTAMP(3),
ADD COLUMN "github_verified_at" TIMESTAMP(3),
ADD COLUMN "github_last_checked_at" TIMESTAMP(3),
ADD COLUMN "github_access_status" TEXT;

CREATE UNIQUE INDEX "projects_user_id_github_repository_id_key"
ON "projects"("user_id", "github_repository_id");


-- Idempotency key for offline direct-message delivery.
ALTER TABLE "direct_messages" ADD COLUMN "client_id" TEXT;
CREATE UNIQUE INDEX "direct_messages_sender_id_client_id_key"
ON "direct_messages"("sender_id", "client_id");
