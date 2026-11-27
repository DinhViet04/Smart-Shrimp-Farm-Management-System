-- Lưu việc xử lý cảnh báo môi trường nước trên server (trước đây chỉ nằm trong localStorage trình duyệt)
CREATE TABLE IF NOT EXISTS "water_treatments" (
    "id" TEXT NOT NULL,
    "water_quality_record_id" TEXT NOT NULL,
    "pond_id" TEXT NOT NULL,
    "treated_by" TEXT NOT NULL,
    "note" TEXT,
    "chemicals" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "water_treatments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "water_treatments_water_quality_record_id_key" ON "water_treatments"("water_quality_record_id");
CREATE INDEX IF NOT EXISTS "water_treatments_pond_id_created_at_idx" ON "water_treatments"("pond_id", "created_at");

ALTER TABLE "water_treatments" ADD CONSTRAINT "water_treatments_water_quality_record_id_fkey" FOREIGN KEY ("water_quality_record_id") REFERENCES "water_quality_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "water_treatments" ADD CONSTRAINT "water_treatments_treated_by_fkey" FOREIGN KEY ("treated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
