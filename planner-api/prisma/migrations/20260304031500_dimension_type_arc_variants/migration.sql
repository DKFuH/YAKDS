-- AlterEnum
ALTER TYPE "DimensionType" ADD VALUE IF NOT EXISTS 'radial';
ALTER TYPE "DimensionType" ADD VALUE IF NOT EXISTS 'arc_length';
ALTER TYPE "DimensionType" ADD VALUE IF NOT EXISTS 'chord';
