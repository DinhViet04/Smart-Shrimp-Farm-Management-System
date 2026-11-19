-- CreateTable
CREATE TABLE "agent_action_executions" (
    "draft_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_action_executions_pkey" PRIMARY KEY ("draft_id")
);

-- CreateIndex
CREATE INDEX "agent_action_executions_user_id_idx" ON "agent_action_executions"("user_id");
