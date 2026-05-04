-- CreateTable
CREATE TABLE "StaffSalesBoardTarget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "yearMonth" TEXT NOT NULL,
    "staff" TEXT NOT NULL,
    "presaleTarget" REAL NOT NULL DEFAULT 0,
    "aftersaleTarget" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "StaffSalesBoardTarget_yearMonth_staff_key" ON "StaffSalesBoardTarget"("yearMonth", "staff");

-- CreateTable
CREATE TABLE "StaffDailyBoardSupplement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "staff" TEXT NOT NULL,
    "presaleOffline" REAL NOT NULL DEFAULT 0,
    "aftersaleSales" REAL NOT NULL DEFAULT 0,
    "afterReshipAmount" REAL NOT NULL DEFAULT 0,
    "afterRefundAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "StaffDailyBoardSupplement_date_staff_key" ON "StaffDailyBoardSupplement"("date", "staff");
