-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "rate_reminder_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_status_rate_reminder_at_idx" ON "orders"("status", "rate_reminder_at");

