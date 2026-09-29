-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DIRECTOR', 'TOP', 'MIDDLE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('PAST', 'ORTA', 'YUQORI');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('YANGI', 'QABUL_QILINDI', 'JARAYONDA', 'BAJARILDI', 'BAJARILMADI', 'QAYTARILDI');

-- CreateEnum
CREATE TYPE "FailReason" AS ENUM ('RESURS_YETMADI', 'BOSHQA_BOLIMGA_BOGLIQ', 'VAQT_YETMADI', 'TOPSHIRIQ_NOANIQ', 'BOSHQA');

-- CreateEnum
CREATE TYPE "FinanceType" AS ENUM ('TUSHUM', 'TANNARX', 'XARAJAT');

-- CreateEnum
CREATE TYPE "GoalCondition" AS ENUM ('GTE', 'LTE');

-- CreateEnum
CREATE TYPE "DecisionVerdict" AS ENUM ('OZINI_OQLADI', 'OQLAMADI', 'HALI_ERTA');

-- CreateEnum
CREATE TYPE "AiModule" AS ENUM ('VAZIFALAR', 'FAOLLIK', 'SKLAD', 'MOLIYA', 'UMUMIY');

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'so''m',
    "weeklyReportTime" TEXT NOT NULL DEFAULT '09:00',
    "weeklyReportDay" INTEGER NOT NULL DEFAULT 1,
    "monthlyReportDay" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "telegramId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MIDDLE',
    "managerId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isStockResponsible" BOOLEAN NOT NULL DEFAULT false,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignerId" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'ORTA',
    "status" "TaskStatus" NOT NULL DEFAULT 'YANGI',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "qualityScore" INTEGER,
    "returnCount" INTEGER NOT NULL DEFAULT 0,
    "failReason" "FailReason",
    "failReasonText" TEXT,
    "remind24Sent" BOOLEAN NOT NULL DEFAULT false,
    "remind2Sent" BOOLEAN NOT NULL DEFAULT false,
    "overdueNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskHistory" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "changedBy" INTEGER,
    "oldStatus" "TaskStatus",
    "newStatus" "TaskStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskFile" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "uploadedBy" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'document',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCheck" (
    "id" SERIAL NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL,
    "warehouse" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalDiff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shortageSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "surplusSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCheckItem" (
    "id" SERIAL NOT NULL,
    "stockCheckId" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "systemQty" DOUBLE PRECISION NOT NULL,
    "actualQty" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diffQty" DOUBLE PRECISION NOT NULL,
    "diffSum" DOUBLE PRECISION NOT NULL,
    "responsible" TEXT,

    CONSTRAINT "StockCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyGoal" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "category" TEXT,
    "condition" "GoalCondition" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "type" "FinanceType" NOT NULL,
    "category" TEXT NOT NULL,
    "planAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "factAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacticalDecision" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metric" TEXT NOT NULL,
    "category" TEXT,
    "expectedResult" TEXT,
    "aiVerdict" "DecisionVerdict",
    "aiComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TacticalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReport" (
    "id" SERIAL NOT NULL,
    "module" "AiModule" NOT NULL,
    "period" TEXT NOT NULL,
    "question" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_telegramId_key" ON "Employee"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_phone_key" ON "Employee"("phone");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_assignerId_idx" ON "Task"("assignerId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_deadline_idx" ON "Task"("deadline");

-- CreateIndex
CREATE INDEX "TaskHistory_taskId_idx" ON "TaskHistory"("taskId");

-- CreateIndex
CREATE INDEX "TaskFile_taskId_idx" ON "TaskFile"("taskId");

-- CreateIndex
CREATE INDEX "StockCheckItem_stockCheckId_idx" ON "StockCheckItem"("stockCheckId");

-- CreateIndex
CREATE INDEX "FinanceEntry_month_idx" ON "FinanceEntry"("month");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_month_type_category_key" ON "FinanceEntry"("month", "type", "category");

-- CreateIndex
CREATE INDEX "AiReport_module_createdAt_idx" ON "AiReport"("module", "createdAt");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignerId_fkey" FOREIGN KEY ("assignerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskFile" ADD CONSTRAINT "TaskFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskFile" ADD CONSTRAINT "TaskFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCheckItem" ADD CONSTRAINT "StockCheckItem_stockCheckId_fkey" FOREIGN KEY ("stockCheckId") REFERENCES "StockCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

