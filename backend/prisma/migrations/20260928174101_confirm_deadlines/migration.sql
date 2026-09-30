-- AlterTable
ALTER TABLE "chef_profiles" ADD COLUMN     "confirm_within_hours" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "chef_reminder_at" TIMESTAMP(3),
ADD COLUMN     "confirm_by" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_status_confirm_by_idx" ON "orders"("status", "confirm_by");

-- CreateIndex
CREATE INDEX "orders_status_chef_reminder_at_idx" ON "orders"("status", "chef_reminder_at");

