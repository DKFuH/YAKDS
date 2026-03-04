-- CreateTable
CREATE TABLE "panorama_tours" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "points_json" JSONB NOT NULL DEFAULT '[]',
  "share_token" TEXT,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "panorama_tours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "panorama_tours_tenant_id_project_id_idx" ON "panorama_tours"("tenant_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "panorama_tours_share_token_key" ON "panorama_tours"("share_token");
