-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FARMER', 'TECHNICIAN', 'ADMIN', 'FARM_MANAGER');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketScope" AS ENUM ('SYSTEM', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('GOOD', 'WARNING', 'DANGER');

-- CreateEnum
CREATE TYPE "CropStatus" AS ENUM ('ACTIVE', 'HARVESTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ShrimpHealthStatus" AS ENUM ('NORMAL', 'LETHARGIC', 'EDGE_GATHERING', 'LOSS_OF_APPETITE');

-- CreateEnum
CREATE TYPE "ShrimpHealthSeverity" AS ENUM ('NORMAL', 'MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "NotificationLevel" AS ENUM ('INFO', 'WARNING', 'DANGER');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'TREATING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentEventType" AS ENUM ('REPORTED', 'ASSIGNED', 'STARTED', 'TREATMENT', 'RESOLVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('FEED', 'MEDICINE', 'CHEMICAL');

-- CreateEnum
CREATE TYPE "FeedingSession" AS ENUM ('SESSION_1', 'SESSION_2', 'SESSION_3', 'SESSION_4', 'SESSION_5', 'SESSION_6', 'SESSION_7');

-- CreateEnum
CREATE TYPE "FeedingMethod" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "FeedingStatus" AS ENUM ('COMPLETED', 'SKIPPED', 'DELAYED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'FARMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "googleId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "address" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "farming_model" TEXT DEFAULT 'HIGH_TECH',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "scope" "SupportTicketScope" NOT NULL DEFAULT 'WORKSPACE',
    "workspace_id" TEXT,
    "requester_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_staffs" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_staffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ponds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaSize" DOUBLE PRECISION NOT NULL,
    "depth" DOUBLE PRECISION NOT NULL,
    "farmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ponds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shrimp_size_samples" (
    "id" TEXT NOT NULL,
    "pond_id" TEXT NOT NULL,
    "sampling_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doc" INTEGER,
    "sample_count" INTEGER NOT NULL,
    "sample_weight_g" DECIMAL(10,2) NOT NULL,
    "sample_length_cm" DECIMAL(5,2),
    "abw_g" DECIMAL(10,2) NOT NULL,
    "size_pieces_per_kg" DECIMAL(10,2) NOT NULL,
    "adg_g_per_day" DECIMAL(10,2),
    "notes" VARCHAR(500),
    "net_area_sqm" DOUBLE PRECISION,
    "cast_details" JSONB,
    "estimated_total_shrimp" INTEGER,
    "estimated_biomass_kg" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shrimp_size_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crops" (
    "id" TEXT NOT NULL,
    "pondId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "initialShrimpCount" INTEGER NOT NULL,
    "status" "CropStatus" NOT NULL DEFAULT 'ACTIVE',
    "target_harvest_size" DOUBLE PRECISION,
    "growth_milestones" JSONB,
    "target_survival_rate" DOUBLE PRECISION,
    "target_total_feed_kg" DOUBLE PRECISION,
    "expected_harvest_date" TIMESTAMP(3),
    "expected_duration_days" INTEGER,
    "stage" TEXT DEFAULT 'COMMERCIAL',
    "expected_transfer_date" TIMESTAMP(3),
    "parent_crop_id" TEXT,
    "transfer_date" TIMESTAMP(3),
    "actual_nursery_harvest" INTEGER,
    "nursery_survival_rate" DOUBLE PRECISION,
    "transfer_size" DOUBLE PRECISION,
    "split_note" TEXT,
    "actual_harvest_count" INTEGER,
    "actual_harvest_kg" DOUBLE PRECISION,
    "actual_harvest_size" DOUBLE PRECISION,
    "actual_harvest_date" TIMESTAMP(3),
    "actual_harvest_price_per_kg" DOUBLE PRECISION,
    "actual_harvest_revenue" DOUBLE PRECISION,
    "actual_harvest_cost" DOUBLE PRECISION,
    "actual_harvest_profit" DOUBLE PRECISION,
    "actual_harvest_fcr" DOUBLE PRECISION,
    "actual_harvest_survival_rate" DOUBLE PRECISION,
    "seed_unit_price" DOUBLE PRECISION,
    "seed_cost" DOUBLE PRECISION,
    "seed_type" TEXT DEFAULT 'Tôm thẻ chân trắng Post 10',
    "seed_source" TEXT DEFAULT 'tepbac.com',
    "harvest_feed_cost" DOUBLE PRECISION,
    "harvest_medicine_cost" DOUBLE PRECISION,
    "harvest_chemical_cost" DOUBLE PRECISION,
    "harvest_seed_cost" DOUBLE PRECISION,
    "harvest_electricity_cost" DOUBLE PRECISION,
    "harvest_labor_cost" DOUBLE PRECISION,
    "harvest_other_cost" DOUBLE PRECISION,
    "harvest_feed_kg" DOUBLE PRECISION,
    "harvest_note" TEXT,
    "harvest_evaluation" VARCHAR(2000),
    "harvest_lessons_learned" VARCHAR(2000),
    "harvest_next_recommendation" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environment_records" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ph" DOUBLE PRECISION,
    "do" DOUBLE PRECISION,
    "alkalinity" DOUBLE PRECISION,
    "nh3" DOUBLE PRECISION,
    "no2" DOUBLE PRECISION,
    "salinity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "environment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "treatment" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reporterId" TEXT,
    "assignedToId" TEXT,
    "startedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_treatment_updates" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "observation" TEXT,
    "result" TEXT,
    "status" "IncidentStatus" NOT NULL,
    "eventType" "IncidentEventType" NOT NULL DEFAULT 'TREATMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_treatment_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_quality_records" (
    "id" TEXT NOT NULL,
    "pondId" TEXT NOT NULL,
    "recordTime" TIMESTAMP(3) NOT NULL,
    "temperature" DECIMAL(5,2) NOT NULL,
    "ph" DECIMAL(4,2) NOT NULL,
    "dissolvedOxygen" DECIMAL(5,2) NOT NULL,
    "salinity" DECIMAL(5,2) NOT NULL,
    "alkalinity" DECIMAL(6,2) NOT NULL,
    "nh3" DECIMAL(6,3) NOT NULL,
    "no2" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "h2s" DECIMAL(6,3),
    "transparency" DECIMAL(5,2) NOT NULL DEFAULT 35,
    "waterColor" TEXT,
    "note" TEXT,
    "weatherData" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_quality_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventories" (
    "id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "package_type" TEXT,
    "package_qty" DOUBLE PRECISION,
    "weight_per_pkg" DOUBLE PRECISION,
    "min_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "shape" TEXT,
    "size_spec" TEXT,
    "price_per_package" DOUBLE PRECISION DEFAULT 0,
    "farm_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "note" TEXT,
    "farm_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_usage_logs" (
    "id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "quantity_used" DOUBLE PRECISION NOT NULL,
    "usage_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "pond_id" TEXT,
    "crop_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shrimp_health_records" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "pond_id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "record_time" TIMESTAMP(3) NOT NULL,
    "health_status" "ShrimpHealthStatus" NOT NULL,
    "severity" "ShrimpHealthSeverity" NOT NULL,
    "affected_percentage" DOUBLE PRECISION NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shrimp_health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT,
    "user_id" TEXT,
    "pond_id" TEXT,
    "level" "NotificationLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feeding_logs" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "pond_id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "feed_product_id" TEXT NOT NULL,
    "feeding_date" DATE NOT NULL,
    "feeding_session" "FeedingSession" NOT NULL,
    "feeding_time" TEXT NOT NULL,
    "feed_amount" DECIMAL(8,2) NOT NULL,
    "feeding_method" "FeedingMethod" NOT NULL,
    "feeding_status" "FeedingStatus" NOT NULL,
    "note" VARCHAR(500),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feeding_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortality_logs" (
    "id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "recorded_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dead_quantity_pcs" INTEGER NOT NULL,
    "cause" TEXT,
    "note" VARCHAR(500),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mortality_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "file_name" TEXT,
    "file_type" TEXT,
    "file_size" INTEGER,
    "content" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "embedding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'SHRIMP_SEED',
    "unit" TEXT NOT NULL DEFAULT 'đ/CON',
    "price" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tepbac.com',
    "source_url" TEXT,
    "price_change" TEXT,
    "last_fetched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "farms_ownerId_deletedAt_idx" ON "farms"("ownerId", "deletedAt");

-- CreateIndex
CREATE INDEX "farms_workspace_id_name_idx" ON "farms"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "farms_workspace_id_deletedAt_idx" ON "farms"("workspace_id", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_status_created_at_idx" ON "workspaces"("status", "created_at");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_is_active_idx" ON "workspace_members"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "support_tickets_workspace_id_status_created_at_idx" ON "support_tickets"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_scope_status_created_at_idx" ON "support_tickets"("scope", "status", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_id_status_idx" ON "support_tickets"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "farm_staffs_user_id_is_active_idx" ON "farm_staffs"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "farm_staffs_farm_id_user_id_key" ON "farm_staffs"("farm_id", "user_id");

-- CreateIndex
CREATE INDEX "ponds_farmId_idx" ON "ponds"("farmId");

-- CreateIndex
CREATE INDEX "shrimp_size_samples_pond_id_sampling_date_idx" ON "shrimp_size_samples"("pond_id", "sampling_date");

-- CreateIndex
CREATE INDEX "crops_pondId_status_startDate_idx" ON "crops"("pondId", "status", "startDate");

-- CreateIndex
CREATE INDEX "crops_status_startDate_idx" ON "crops"("status", "startDate");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_revoked_at_idx" ON "refresh_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_expires_at_idx" ON "refresh_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_created_at_idx" ON "admin_audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_otps_email_key" ON "password_reset_otps"("email");

-- CreateIndex
CREATE INDEX "password_reset_otps_expires_at_idx" ON "password_reset_otps"("expires_at");

-- CreateIndex
CREATE INDEX "incidents_cropId_status_idx" ON "incidents"("cropId", "status");

-- CreateIndex
CREATE INDEX "incidents_assignedToId_status_updatedAt_idx" ON "incidents"("assignedToId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "incidents_reporterId_idx" ON "incidents"("reporterId");

-- CreateIndex
CREATE INDEX "incident_treatment_updates_incidentId_createdAt_idx" ON "incident_treatment_updates"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "water_quality_records_pondId_recordTime_idx" ON "water_quality_records"("pondId", "recordTime");

-- CreateIndex
CREATE INDEX "inventories_farm_id_deleted_at_category_created_at_idx" ON "inventories"("farm_id", "deleted_at", "category", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_item_name_farm_id_key" ON "inventories"("item_name", "farm_id");

-- CreateIndex
CREATE INDEX "suppliers_farm_id_deleted_at_name_idx" ON "suppliers"("farm_id", "deleted_at", "name");

-- CreateIndex
CREATE INDEX "inventory_usage_logs_inventory_id_usage_date_idx" ON "inventory_usage_logs"("inventory_id", "usage_date");

-- CreateIndex
CREATE INDEX "inventory_usage_logs_pond_id_usage_date_idx" ON "inventory_usage_logs"("pond_id", "usage_date");

-- CreateIndex
CREATE INDEX "inventory_usage_logs_crop_id_usage_date_idx" ON "inventory_usage_logs"("crop_id", "usage_date");

-- CreateIndex
CREATE INDEX "shrimp_health_records_pond_id_crop_id_record_time_idx" ON "shrimp_health_records"("pond_id", "crop_id", "record_time");

-- CreateIndex
CREATE INDEX "shrimp_health_records_farm_id_record_time_idx" ON "shrimp_health_records"("farm_id", "record_time");

-- CreateIndex
CREATE INDEX "notifications_farm_id_is_read_idx" ON "notifications"("farm_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "feeding_logs_pond_id_crop_id_feeding_date_idx" ON "feeding_logs"("pond_id", "crop_id", "feeding_date");

-- CreateIndex
CREATE INDEX "feeding_logs_farm_id_feeding_date_idx" ON "feeding_logs"("farm_id", "feeding_date");

-- CreateIndex
CREATE UNIQUE INDEX "feeding_logs_farm_id_pond_id_crop_id_feeding_date_feeding_s_key" ON "feeding_logs"("farm_id", "pond_id", "crop_id", "feeding_date", "feeding_session");

-- CreateIndex
CREATE INDEX "mortality_logs_crop_id_recorded_date_idx" ON "mortality_logs"("crop_id", "recorded_date");

-- CreateIndex
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_prices_code_key" ON "market_prices"("code");

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_staffs" ADD CONSTRAINT "farm_staffs_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_staffs" ADD CONSTRAINT "farm_staffs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ponds" ADD CONSTRAINT "ponds_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shrimp_size_samples" ADD CONSTRAINT "shrimp_size_samples_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crops" ADD CONSTRAINT "crops_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crops" ADD CONSTRAINT "crops_parent_crop_id_fkey" FOREIGN KEY ("parent_crop_id") REFERENCES "crops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment_records" ADD CONSTRAINT "environment_records_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_treatment_updates" ADD CONSTRAINT "incident_treatment_updates_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_treatment_updates" ADD CONSTRAINT "incident_treatment_updates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_quality_records" ADD CONSTRAINT "water_quality_records_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_quality_records" ADD CONSTRAINT "water_quality_records_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_usage_logs" ADD CONSTRAINT "inventory_usage_logs_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_usage_logs" ADD CONSTRAINT "inventory_usage_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shrimp_health_records" ADD CONSTRAINT "shrimp_health_records_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shrimp_health_records" ADD CONSTRAINT "shrimp_health_records_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shrimp_health_records" ADD CONSTRAINT "shrimp_health_records_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shrimp_health_records" ADD CONSTRAINT "shrimp_health_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_logs" ADD CONSTRAINT "feeding_logs_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_logs" ADD CONSTRAINT "feeding_logs_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_logs" ADD CONSTRAINT "feeding_logs_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_logs" ADD CONSTRAINT "feeding_logs_feed_product_id_fkey" FOREIGN KEY ("feed_product_id") REFERENCES "inventories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_logs" ADD CONSTRAINT "feeding_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortality_logs" ADD CONSTRAINT "mortality_logs_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortality_logs" ADD CONSTRAINT "mortality_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce one active owner per workspace (partial indexes are not represented in Prisma schema).
CREATE UNIQUE INDEX "workspace_single_active_owner"
ON "workspace_members" ("workspace_id")
WHERE "role" = 'OWNER' AND "is_active" = true;
