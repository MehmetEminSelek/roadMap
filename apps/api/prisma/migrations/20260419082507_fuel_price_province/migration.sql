-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "preferredFuelBrand" TEXT;

-- CreateTable
CREATE TABLE "BrandProvincePrice" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "provinceCode" INTEGER NOT NULL,
    "petrol" DOUBLE PRECISION,
    "diesel" DOUBLE PRECISION,
    "lpg" DOUBLE PRECISION,
    "live" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandProvincePrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandProvincePrice_provinceCode_idx" ON "BrandProvincePrice"("provinceCode");

-- CreateIndex
CREATE INDEX "BrandProvincePrice_updatedAt_idx" ON "BrandProvincePrice"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProvincePrice_brandId_provinceCode_key" ON "BrandProvincePrice"("brandId", "provinceCode");
