-- CreateEnum
CREATE TYPE "LocationPrecision" AS ENUM ('ADDRESS', 'ZIP_CODE');

-- AlterTable
ALTER TABLE "chef_profiles" ADD COLUMN     "location_precision" "LocationPrecision";

