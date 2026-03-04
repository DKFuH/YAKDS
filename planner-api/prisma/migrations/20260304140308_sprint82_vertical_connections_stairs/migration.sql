-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "ceiling_openings" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "vertical_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "from_level_id" TEXT NOT NULL,
    "to_level_id" TEXT NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "footprint_json" JSONB NOT NULL,
    "stair_json" JSONB NOT NULL DEFAULT '{}',
    "opening_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vertical_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vertical_connections_tenant_id_project_id_idx" ON "vertical_connections"("tenant_id", "project_id");

-- AddForeignKey
ALTER TABLE "vertical_connections" ADD CONSTRAINT "vertical_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vertical_connections" ADD CONSTRAINT "vertical_connections_from_level_id_fkey" FOREIGN KEY ("from_level_id") REFERENCES "building_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vertical_connections" ADD CONSTRAINT "vertical_connections_to_level_id_fkey" FOREIGN KEY ("to_level_id") REFERENCES "building_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
