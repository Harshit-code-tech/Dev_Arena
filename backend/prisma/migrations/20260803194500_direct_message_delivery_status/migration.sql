ALTER TABLE "direct_messages"
  ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "direct_messages_conversation_id_delivered_at_idx"
  ON "direct_messages"("conversation_id", "delivered_at");

CREATE INDEX IF NOT EXISTS "direct_messages_conversation_id_read_at_idx"
  ON "direct_messages"("conversation_id", "read_at");
