-- CreateTable
CREATE TABLE "offline_sync_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "project_id" TEXT,
    "entity_type" VARCHAR(120) NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offline_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offline_sync_jobs_tenant_id_status_idx" ON "offline_sync_jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "offline_sync_jobs_tenant_id_project_id_status_idx" ON "offline_sync_jobs"("tenant_id", "project_id", "status");
