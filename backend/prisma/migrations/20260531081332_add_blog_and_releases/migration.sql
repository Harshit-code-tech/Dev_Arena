-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "release_tag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Released',
    "changelog_specs" TEXT[],
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blog_posts_author_id_created_at_idx" ON "blog_posts"("author_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "blog_posts_is_draft_created_at_idx" ON "blog_posts"("is_draft", "created_at" DESC);

-- CreateIndex
CREATE INDEX "releases_released_at_idx" ON "releases"("released_at" DESC);

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
