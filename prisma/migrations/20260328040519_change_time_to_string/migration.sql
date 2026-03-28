-- AlterTable
ALTER TABLE "attendances" ALTER COLUMN "date" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "leave_requests" ALTER COLUMN "start_time" SET DATA TYPE TEXT,
ALTER COLUMN "end_time" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "attendances_user_id_date_idx" ON "attendances"("user_id", "date");
