-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "level_id" TEXT;

-- CreateTable
CREATE TABLE "building_levels" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "elevation_mm" INTEGER NOT NULL DEFAULT 0,
    "height_mm" INTEGER,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "building_levels_tenant_id_project_id_order_index_idx" ON "building_levels"("tenant_id", "project_id", "order_index");

-- CreateIndex
CREATE INDEX "rooms_project_id_level_id_idx" ON "rooms"("project_id", "level_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "building_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_levels" ADD CONSTRAINT "building_levels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
