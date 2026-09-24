-- AlterTable
ALTER TABLE "chef_profiles" ADD COLUMN     "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "offers_delivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offers_pickup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "order_lead_time_hours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;

-- CreateTable
CREATE TABLE "chef_availability" (
    "id" TEXT NOT NULL,
    "chef_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "chef_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chef_availability_chef_id_day_of_week_key" ON "chef_availability"("chef_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "chef_availability" ADD CONSTRAINT "chef_availability_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "chef_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
