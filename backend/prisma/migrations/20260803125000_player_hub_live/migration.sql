-- Live Player Hub: collaboration, community, saves, safety, encrypted direct chat.
ALTER TABLE "users"
  ADD COLUMN "chat_public_key" JSONB,
  ADD COLUMN "chat_key_version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "player_blocks" (
  "id" TEXT NOT NULL,
  "blocker_id" TEXT NOT NULL,
  "blocked_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_blocks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "player_blocks_blocker_id_blocked_id_key" ON "player_blocks"("blocker_id", "blocked_id");
CREATE INDEX "player_blocks_blocked_id_created_at_idx" ON "player_blocks"("blocked_id", "created_at" DESC);

CREATE TABLE "player_reports" (
  "id" TEXT NOT NULL,
  "reporter_id" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Open',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "player_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "player_reports_reporter_id_created_at_idx" ON "player_reports"("reporter_id", "created_at" DESC);
CREATE INDEX "player_reports_subject_type_subject_id_status_idx" ON "player_reports"("subject_type", "subject_id", "status");

CREATE TABLE "project_saves" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_saves_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_saves_user_id_project_id_key" ON "project_saves"("user_id", "project_id");
CREATE INDEX "project_saves_project_id_created_at_idx" ON "project_saves"("project_id", "created_at" DESC);

CREATE TABLE "collaboration_posts" (
  "id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "skills" TEXT[],
  "commitment" TEXT NOT NULL,
  "positions" INTEGER NOT NULL DEFAULT 1,
  "deadline" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'Open',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_posts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "collaboration_posts_status_created_at_idx" ON "collaboration_posts"("status", "created_at" DESC);
CREATE INDEX "collaboration_posts_author_id_created_at_idx" ON "collaboration_posts"("author_id", "created_at" DESC);

CREATE TABLE "collaboration_applications" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "applicant_id" TEXT NOT NULL,
  "introduction" TEXT NOT NULL,
  "availability" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "collaboration_applications_post_id_applicant_id_key" ON "collaboration_applications"("post_id", "applicant_id");
CREATE INDEX "collaboration_applications_applicant_id_created_at_idx" ON "collaboration_applications"("applicant_id", "created_at" DESC);

CREATE TABLE "community_posts" (
  "id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "code_snippet" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "community_posts_created_at_idx" ON "community_posts"("created_at" DESC);
CREATE INDEX "community_posts_author_id_created_at_idx" ON "community_posts"("author_id", "created_at" DESC);

CREATE TABLE "community_comments" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "community_comments_post_id_created_at_idx" ON "community_comments"("post_id", "created_at");

CREATE TABLE "community_reactions" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'Like',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_reactions_post_id_user_id_key" ON "community_reactions"("post_id", "user_id");

CREATE TABLE "community_saves" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_saves_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_saves_post_id_user_id_key" ON "community_saves"("post_id", "user_id");

CREATE TABLE "direct_conversations" (
  "id" TEXT NOT NULL,
  "user_a_id" TEXT NOT NULL,
  "user_b_id" TEXT NOT NULL,
  "user_a_last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "user_b_last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_message_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "direct_conversations_user_a_id_user_b_id_key" ON "direct_conversations"("user_a_id", "user_b_id");
CREATE INDEX "direct_conversations_user_a_id_last_message_at_idx" ON "direct_conversations"("user_a_id", "last_message_at" DESC);
CREATE INDEX "direct_conversations_user_b_id_last_message_at_idx" ON "direct_conversations"("user_b_id", "last_message_at" DESC);

CREATE TABLE "direct_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL DEFAULT 'AES-GCM',
  "sender_key_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "edited_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "direct_messages_conversation_id_created_at_idx" ON "direct_messages"("conversation_id", "created_at" DESC);
CREATE INDEX "direct_messages_sender_id_created_at_idx" ON "direct_messages"("sender_id", "created_at" DESC);

ALTER TABLE "player_blocks" ADD CONSTRAINT "player_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_blocks" ADD CONSTRAINT "player_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_saves" ADD CONSTRAINT "project_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_saves" ADD CONSTRAINT "project_saves_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_posts" ADD CONSTRAINT "collaboration_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_applications" ADD CONSTRAINT "collaboration_applications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "collaboration_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_applications" ADD CONSTRAINT "collaboration_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_saves" ADD CONSTRAINT "community_saves_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_saves" ADD CONSTRAINT "community_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
