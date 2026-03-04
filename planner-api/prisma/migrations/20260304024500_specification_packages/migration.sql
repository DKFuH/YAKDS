-- CreateTable
CREATE TABLE "specification_packages" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "config_json" JSONB NOT NULL DEFAULT '{}',
  "generated_at" TIMESTAMP(3),
  "artifact_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "specification_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "specification_packages_tenant_id_project_id_idx" ON "specification_packages"("tenant_id", "project_id");
