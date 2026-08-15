-- DevArena now stores only the repository URL entered by the user,
-- GitHub language percentages, and the language refresh timestamp.
-- Remove previously synchronized repository metadata and technology evidence.

DELETE FROM "github_authorized_repositories";
DELETE FROM "github_installation_access";

UPDATE "projects"
SET
  "github_repository_node_id" = NULL,
  "github_owner_id" = NULL,
  "github_repository_id" = NULL,
  "github_repository_owner" = NULL,
  "github_repository_name" = NULL,
  "github_repository_full_name" = NULL,
  "github_repository_private" = NULL,
  "github_visibility" = NULL,
  "github_repository_default_branch" = NULL,
  "github_installation_id" = NULL,
  "github_permission" = NULL,
  "github_role_name" = NULL,
  "github_technology_stack" = NULL,
  "github_technology_fetched_at" = NULL,
  "github_technology_status" = NULL,
  "github_last_pushed_at" = NULL,
  "github_verified_at" = NULL,
  "github_last_checked_at" = NULL,
  "github_access_status" = NULL;
