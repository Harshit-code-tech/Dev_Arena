-- Public project sharing and platform pulse statistics.
ALTER TABLE "projects"
  ADD COLUMN "is_shared" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "share_slug" TEXT,
  ADD COLUMN "shared_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "projects_share_slug_key" ON "projects"("share_slug");
CREATE INDEX "projects_is_shared_shared_at_idx" ON "projects"("is_shared", "shared_at" DESC);
