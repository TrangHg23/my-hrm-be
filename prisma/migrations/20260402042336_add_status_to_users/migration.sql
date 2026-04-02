-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('WORKING', 'PROBATION', 'RESIGNED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "EmployeeStatus" DEFAULT 'PROBATION';
