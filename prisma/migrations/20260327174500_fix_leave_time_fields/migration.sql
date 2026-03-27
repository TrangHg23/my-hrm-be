-- AlterTable
ALTER TABLE "leave_requests"
  ALTER COLUMN "start_time" TYPE TIMESTAMPTZ
  USING ('1970-01-01 ' || "start_time")::TIMESTAMPTZ AT TIME ZONE 'Asia/Ho_Chi_Minh',
  ALTER COLUMN "end_time" TYPE TIMESTAMPTZ
  USING ('1970-01-01 ' || "end_time")::TIMESTAMPTZ AT TIME ZONE 'Asia/Ho_Chi_Minh';
