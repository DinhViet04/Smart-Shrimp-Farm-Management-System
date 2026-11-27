-- Bảng lịch sử hội thoại Trợ lý AI (model AiChatSession trong schema.prisma).
CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
  "id"         TEXT         NOT NULL,
  "user_id"    TEXT         NOT NULL,
  "title"      TEXT         NOT NULL,
  "messages"   JSONB        NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_id_updated_at_idx"
  ON "ai_chat_sessions" ("user_id", "updated_at");
