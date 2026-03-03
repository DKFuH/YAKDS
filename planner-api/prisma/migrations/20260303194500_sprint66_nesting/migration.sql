DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NestingJobStatus') THEN
    CREATE TYPE "NestingJobStatus" AS ENUM ('draft', 'calculated', 'exported');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "nesting_jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "source_cutlist_id" TEXT NOT NULL,
  "sheet_width_mm" INTEGER NOT NULL,
  "sheet_height_mm" INTEGER NOT NULL,
  "kerf_mm" INTEGER NOT NULL DEFAULT 4,
  "allow_rotate" BOOLEAN NOT NULL DEFAULT true,
  "status" "NestingJobStatus" NOT NULL DEFAULT 'draft',
  "result_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "nesting_jobs_tenant_id_project_id_idx" ON "nesting_jobs"("tenant_id", "project_id");
CREATE INDEX IF NOT EXISTS "nesting_jobs_source_cutlist_id_idx" ON "nesting_jobs"("source_cutlist_id");
