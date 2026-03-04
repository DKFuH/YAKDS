-- Backfill default level for existing projects
INSERT INTO "building_levels" (
    "id",
    "tenant_id",
    "project_id",
    "name",
    "elevation_mm",
    "order_index",
    "visible",
    "config_json",
    "created_at",
    "updated_at"
)
SELECT
    CONCAT(p."id", '-eg') AS "id",
    COALESCE(p."tenant_id", '00000000-0000-0000-0000-000000000001') AS "tenant_id",
    p."id" AS "project_id",
    'EG' AS "name",
    0 AS "elevation_mm",
    0 AS "order_index",
    true AS "visible",
    '{}'::jsonb AS "config_json",
    NOW() AS "created_at",
    NOW() AS "updated_at"
FROM "projects" p
WHERE NOT EXISTS (
    SELECT 1
    FROM "building_levels" bl
    WHERE bl."project_id" = p."id"
);

UPDATE "rooms" r
SET "level_id" = bl."id"
FROM "building_levels" bl
WHERE bl."project_id" = r."project_id"
  AND bl."order_index" = 0
  AND bl."name" = 'EG'
  AND r."level_id" IS NULL;
