-- Sprint 61: Angebots-PDF mit Firmenprofil
-- Add company profile and banking fields to tenant_settings

ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "company_name"   VARCHAR(200);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "company_street" VARCHAR(200);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "company_zip"    VARCHAR(20);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "company_city"   VARCHAR(100);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "company_phone"  VARCHAR(50);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "company_email"  VARCHAR(200);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "company_web"    VARCHAR(200);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "iban"           VARCHAR(50);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "bic"            VARCHAR(20);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "bank_name"      VARCHAR(100);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "vat_id"         VARCHAR(30);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "tax_number"     VARCHAR(30);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "quote_footer"   TEXT;
