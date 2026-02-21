-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "entryNumber" TEXT,
ADD COLUMN     "photoFilename" TEXT;

-- CreateTable
CREATE TABLE "imported_clients" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT,
    "addressRaw" TEXT,
    "membershipDurationMonths" INTEGER NOT NULL DEFAULT 1,
    "membershipAmount" DECIMAL(10,2),
    "paymentMode" TEXT,
    "joinDate" TIMESTAMP(3),
    "photoFilename" TEXT,
    "sender" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "needsManualReview" BOOLEAN NOT NULL DEFAULT true,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolvedClientId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_clients_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "imported_clients" ADD CONSTRAINT "imported_clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
