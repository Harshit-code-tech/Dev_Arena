CREATE TABLE "chat_totp_recoveries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_iv" TEXT NOT NULL,
    "private_key_ciphertext" TEXT NOT NULL,
    "private_key_iv" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "last_counter" INTEGER,
    "enabled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_totp_recoveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_totp_recoveries_user_id_key" ON "chat_totp_recoveries"("user_id");

ALTER TABLE "chat_totp_recoveries"
ADD CONSTRAINT "chat_totp_recoveries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
