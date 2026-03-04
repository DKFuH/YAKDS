-- Sprint 84: Core-i18n – add locale fields to tenant_settings
ALTER TABLE "tenant_settings" ADD COLUMN "preferred_locale" VARCHAR(10);
ALTER TABLE "tenant_settings" ADD COLUMN "fallback_locale" VARCHAR(10);
