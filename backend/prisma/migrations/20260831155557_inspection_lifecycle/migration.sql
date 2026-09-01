-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "status" "InspectionStatus" NOT NULL DEFAULT 'IN_PROGRESS';
