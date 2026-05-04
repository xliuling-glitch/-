/*
  Warnings:

  - You are about to drop the `Warning` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Warning";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "DailySales" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "staff" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "reception" INTEGER NOT NULL,
    "aftersale" INTEGER NOT NULL,
    "invalidInquiry" INTEGER NOT NULL,
    "presale" INTEGER NOT NULL,
    "deals" INTEGER NOT NULL,
    "sales" REAL NOT NULL
);
