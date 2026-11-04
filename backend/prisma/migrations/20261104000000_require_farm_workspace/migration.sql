DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "farms" WHERE "workspace_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require farms.workspace_id while legacy farms still exist';
  END IF;
END $$;

ALTER TABLE "farms"
ALTER COLUMN "workspace_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_single_active_owner"
ON "workspace_members" ("workspace_id")
WHERE "role" = 'OWNER' AND "is_active" = true;
