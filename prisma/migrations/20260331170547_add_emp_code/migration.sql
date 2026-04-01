/*
  Warnings:

  - A unique constraint covering the columns `[emp_code]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emp_code" VARCHAR(10);

-- CreateIndex
CREATE UNIQUE INDEX "users_emp_code_key" ON "users"("emp_code");
