-- AlterTable
ALTER TABLE "shrimp_size_samples" ADD COLUMN "created_by" TEXT;

-- CreateIndex
CREATE INDEX "shrimp_size_samples_created_by_idx" ON "shrimp_size_samples"("created_by");

-- AddForeignKey
ALTER TABLE "shrimp_size_samples" ADD CONSTRAINT "shrimp_size_samples_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
