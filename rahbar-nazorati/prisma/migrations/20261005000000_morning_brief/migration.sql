-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "morningBriefEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "morningBriefTime" TEXT NOT NULL DEFAULT '08:30';
