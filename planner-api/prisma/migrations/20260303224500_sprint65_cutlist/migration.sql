DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GrainDir') THEN
    CREATE TYPE "GrainDir" AS ENUM ('none', 'length', 'width');
  END IF;
END
$$;

ALTER TABLE "catalog_articles"
  ADD COLUMN IF NOT EXISTS "material_code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "material_label" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "grain_direction" "GrainDir",
  ADD COLUMN IF NOT EXISTS "cutlist_parts" JSONB;

CREATE TABLE IF NOT EXISTS "cutlists" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "project_id" TEXT NOT NULL,
  "room_id" TEXT,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "parts" JSONB NOT NULL,
  "summary" JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS "cutlists_project_id_idx" ON "cutlists"("project_id");
