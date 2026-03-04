-- Sprint 87: navigation settings
ALTER TABLE "tenant_settings" ADD COLUMN "navigation_profile" VARCHAR(20);
ALTER TABLE "tenant_settings" ADD COLUMN "invert_y_axis" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_settings" ADD COLUMN "middle_mouse_pan" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_settings" ADD COLUMN "touchpad_mode" VARCHAR(20);
ALTER TABLE "tenant_settings" ADD COLUMN "zoom_direction" VARCHAR(20);
