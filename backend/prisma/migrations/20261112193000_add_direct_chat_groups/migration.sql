-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ChatGroupType" AS ENUM ('FARM_GROUP', 'DIRECT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "chat_groups" ADD COLUMN IF NOT EXISTS "type" "ChatGroupType" NOT NULL DEFAULT 'FARM_GROUP';
ALTER TABLE "chat_groups" ADD COLUMN IF NOT EXISTS "direct_key" TEXT;
ALTER TABLE "chat_groups" ALTER COLUMN "farm_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "chat_groups_direct_key_key" ON "chat_groups"("direct_key");
CREATE INDEX IF NOT EXISTS "chat_groups_type_idx" ON "chat_groups"("type");

