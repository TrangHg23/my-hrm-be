/*
  Warnings:

  - You are about to drop the column `checkin_time` on the `attendances` table. All the data in the column will be lost.
  - You are about to drop the column `checkout_time` on the `attendances` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "attendances" DROP COLUMN "checkin_time",
DROP COLUMN "checkout_time",
ADD COLUMN     "total_hours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "processed_by_id" TEXT;

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "checkin_time" TIMESTAMP(3) NOT NULL,
    "checkout_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
