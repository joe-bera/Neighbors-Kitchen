-- AlterTable
ALTER TABLE "chef_profiles" ADD COLUMN     "approx_latitude" DECIMAL(9,6),
ADD COLUMN     "approx_longitude" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_distance_miles" DECIMAL(5,1);

