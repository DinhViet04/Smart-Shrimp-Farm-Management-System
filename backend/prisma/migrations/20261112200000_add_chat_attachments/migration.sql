-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_url" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_name" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_type" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_size" INTEGER;

