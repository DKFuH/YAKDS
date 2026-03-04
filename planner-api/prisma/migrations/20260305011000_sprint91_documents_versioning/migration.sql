-- Sprint 91: Dokumente, PDF-Archiv & Versionssicherung

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'order_pdf';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'spec_package';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'manual_upload';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'conflict_entry';

ALTER TYPE "DocumentSourceKind" ADD VALUE IF NOT EXISTS 'order_export';
ALTER TYPE "DocumentSourceKind" ADD VALUE IF NOT EXISTS 'spec_export';
ALTER TYPE "DocumentSourceKind" ADD VALUE IF NOT EXISTS 'archive_version';
ALTER TYPE "DocumentSourceKind" ADD VALUE IF NOT EXISTS 'offline_sync';
ALTER TYPE "DocumentSourceKind" ADD VALUE IF NOT EXISTS 'conflict_local';

ALTER TABLE "documents"
  ADD COLUMN "storage_path" TEXT,
  ADD COLUMN "version_no" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "sent_at" TIMESTAMP(3),
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "version_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "conflict_marker" BOOLEAN NOT NULL DEFAULT false;

UPDATE "documents"
SET
  "version_no" = GREATEST("storage_version", 1),
  "storage_path" = "storage_key"
WHERE "storage_path" IS NULL;

CREATE INDEX "documents_tenant_project_source_version_idx"
  ON "documents"("tenant_id", "project_id", "source_kind", "source_id", "version_no");

CREATE INDEX "documents_tenant_project_filename_version_idx"
  ON "documents"("tenant_id", "project_id", "filename", "version_no");
