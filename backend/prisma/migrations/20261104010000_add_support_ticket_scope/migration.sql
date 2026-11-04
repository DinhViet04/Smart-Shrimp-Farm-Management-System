CREATE TYPE "SupportTicketScope" AS ENUM ('SYSTEM', 'WORKSPACE');

ALTER TABLE "support_tickets"
ADD COLUMN "scope" "SupportTicketScope" NOT NULL DEFAULT 'WORKSPACE',
ALTER COLUMN "workspace_id" DROP NOT NULL;

ALTER TABLE "support_tickets"
DROP CONSTRAINT IF EXISTS "support_tickets_workspace_id_fkey";

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "support_tickets_scope_status_created_at_idx"
ON "support_tickets"("scope", "status", "created_at");
