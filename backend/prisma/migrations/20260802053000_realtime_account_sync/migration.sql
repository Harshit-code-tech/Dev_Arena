CREATE TABLE "realtime_events" (
  "id" BIGSERIAL NOT NULL,
  "user_id" TEXT,
  "type" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realtime_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "realtime_events_user_id_id_idx"
  ON "realtime_events"("user_id", "id");

CREATE INDEX "realtime_events_created_at_idx"
  ON "realtime_events"("created_at");

ALTER TABLE "realtime_events"
  ADD CONSTRAINT "realtime_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
