-- CreateTable
CREATE TABLE "Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "staff" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "inquiryType" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "customerType" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "phone" TEXT,
    "wechat" TEXT,
    "wechatAdded" BOOLEAN NOT NULL,
    "holdSent" BOOLEAN NOT NULL,
    "intentLevel" INTEGER,
    "tier" TEXT,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "FollowupLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "staff" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusNote" TEXT,
    "isDeal" BOOLEAN NOT NULL,
    "dealAmount" REAL,
    "lostReason" TEXT,
    "nextAction" TEXT
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "staff" TEXT NOT NULL,
    "lastSubmitAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadsAdded" INTEGER NOT NULL DEFAULT 0,
    "followupsAdded" INTEGER NOT NULL DEFAULT 0,
    "dealsAdded" INTEGER NOT NULL DEFAULT 0,
    "dealAmountAdded" REAL NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_date_staff_key" ON "DailyActivity"("date", "staff");
