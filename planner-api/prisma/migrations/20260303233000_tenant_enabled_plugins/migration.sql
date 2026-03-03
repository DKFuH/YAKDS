ALTER TABLE "tenant_settings"
ADD COLUMN IF NOT EXISTS "enabled_plugins" JSONB NOT NULL DEFAULT '[]'::jsonb;
