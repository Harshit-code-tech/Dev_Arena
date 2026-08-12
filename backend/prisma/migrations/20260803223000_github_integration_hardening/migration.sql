-- Harden GitHub installation tracking, repository evidence, and technology detection.
ALTER TABLE "github_connections"
  ADD COLUMN IF NOT EXISTS "install_state_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "install_state_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "github_connections_install_state_hash_key"
  ON "github_connections"("install_state_hash");

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "github_repository_node_id" TEXT,
  ADD COLUMN IF NOT EXISTS "github_owner_id" TEXT,
  ADD COLUMN IF NOT EXISTS "github_visibility" TEXT,
  ADD COLUMN IF NOT EXISTS "github_role_name" TEXT,
  ADD COLUMN IF NOT EXISTS "github_technology_stack" JSONB,
  ADD COLUMN IF NOT EXISTS "github_technology_fetched_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "github_technology_status" TEXT,
  ADD COLUMN IF NOT EXISTS "github_last_pushed_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "github_installation_access" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "installation_id" TEXT NOT NULL,
  "account_id" TEXT,
  "account_login" TEXT,
  "account_type" TEXT,
  "repository_selection" TEXT,
  "permissions" JSONB,
  "events" JSONB,
  "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "github_installation_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "github_installation_access_user_id_installation_id_key"
  ON "github_installation_access"("user_id", "installation_id");
CREATE INDEX IF NOT EXISTS "github_installation_access_installation_id_idx"
  ON "github_installation_access"("installation_id");

DO $$ BEGIN
  ALTER TABLE "github_installation_access"
    ADD CONSTRAINT "github_installation_access_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "github_authorized_repositories" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "installation_access_id" TEXT NOT NULL,
  "repository_id" TEXT NOT NULL,
  "node_id" TEXT,
  "owner_id" TEXT,
  "owner_login" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "is_private" BOOLEAN NOT NULL,
  "visibility" TEXT,
  "default_branch" TEXT NOT NULL,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "disabled" BOOLEAN NOT NULL DEFAULT false,
  "permission" TEXT NOT NULL,
  "role_name" TEXT,
  "pushed_at" TIMESTAMP(3),
  "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "github_authorized_repositories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "github_authorized_repositories_user_id_repository_id_key"
  ON "github_authorized_repositories"("user_id", "repository_id");
CREATE INDEX IF NOT EXISTS "github_authorized_repositories_installation_access_id_full_name_idx"
  ON "github_authorized_repositories"("installation_access_id", "full_name");
CREATE INDEX IF NOT EXISTS "github_authorized_repositories_user_id_full_name_idx"
  ON "github_authorized_repositories"("user_id", "full_name");

DO $$ BEGIN
  ALTER TABLE "github_authorized_repositories"
    ADD CONSTRAINT "github_authorized_repositories_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "github_authorized_repositories"
    ADD CONSTRAINT "github_authorized_repositories_installation_access_id_fkey"
    FOREIGN KEY ("installation_access_id") REFERENCES "github_installation_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
