ALTER TABLE "notifications"
  ADD COLUMN "entity_type" TEXT,
  ADD COLUMN "entity_id" TEXT;

-- Link existing pending player-request notifications where the original sender name still matches.
UPDATE "notifications" AS notification
SET
  "entity_type" = 'player_request',
  "entity_id" = request."id"
FROM "friend_requests" AS request
JOIN "users" AS sender ON sender."id" = request."sender_id"
WHERE notification."user_id" = request."receiver_id"
  AND notification."link" = '/players'
  AND notification."message" = sender."name" || ' sent you a player request.'
  AND request."status" = 'Pending'
  AND notification."created_at" BETWEEN request."created_at" - INTERVAL '5 minutes'
                                    AND request."created_at" + INTERVAL '5 minutes';

CREATE INDEX "notifications_user_id_entity_type_entity_id_idx"
  ON "notifications"("user_id", "entity_type", "entity_id");
