-- Sprint 92: Projektarchiv, Kontakte & Shop-Defaults

CREATE TYPE "ContactPartyKind" AS ENUM ('company', 'private_person', 'contact_person');

ALTER TABLE "projects"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "retention_until" TIMESTAMP(3),
  ADD COLUMN "archive_reason" VARCHAR(500);

ALTER TABLE "tenant_settings"
  ADD COLUMN "default_advisor" VARCHAR(200),
  ADD COLUMN "default_processor" VARCHAR(200),
  ADD COLUMN "default_area_name" VARCHAR(200),
  ADD COLUMN "default_alternative_name" VARCHAR(200);

ALTER TABLE "contacts"
  ADD COLUMN "party_kind" "ContactPartyKind" NOT NULL DEFAULT 'private_person',
  ADD COLUMN "contact_role" TEXT;

CREATE INDEX "projects_status_archived_at_idx"
  ON "projects"("status", "archived_at");
