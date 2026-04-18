/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `VehicleMake` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[makeId,name]` on the table `VehicleModel` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "FavoriteRoute" DROP CONSTRAINT "FavoriteRoute_routeId_fkey";

-- DropIndex
DROP INDEX "VehicleMake_name_idx";

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "alternativesJson" JSONB,
ADD COLUMN     "routeStepsJson" JSONB,
ADD COLUMN     "tollDetails" JSONB;

-- AlterTable
ALTER TABLE "TollStation" ADD COLUMN     "highway" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "VehicleTrim" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "engineCapacity" INTEGER,
    "transmission" "Transmission",
    "fuelEconomyL100" DOUBLE PRECISION,
    "enginePowerHp" INTEGER,
    "torqueNm" INTEGER,
    "tankCapacityL" INTEGER,
    "weightKg" INTEGER,
    "variantName" TEXT,

    CONSTRAINT "VehicleTrim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleTrim_modelId_idx" ON "VehicleTrim"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTrim_modelId_year_fuelType_engineCapacity_key" ON "VehicleTrim"("modelId", "year", "fuelType", "engineCapacity");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMake_name_key" ON "VehicleMake"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_makeId_name_key" ON "VehicleModel"("makeId", "name");

-- AddForeignKey
ALTER TABLE "VehicleTrim" ADD CONSTRAINT "VehicleTrim_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteRoute" ADD CONSTRAINT "FavoriteRoute_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
