-- AlterTable
ALTER TABLE "attendance_sessions" ALTER COLUMN "checkin_time" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "checkout_time" SET DATA TYPE TIMESTAMPTZ;
