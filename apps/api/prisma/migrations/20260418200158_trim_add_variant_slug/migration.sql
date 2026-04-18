/*
  Warnings:

  - A unique constraint covering the columns `[modelId,year,variantSlug]` on the table `VehicleTrim` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `variantSlug` to the `VehicleTrim` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "VehicleTrim_modelId_year_fuelType_engineCapacity_key";

-- AlterTable
ALTER TABLE "VehicleTrim" ADD COLUMN     "variantSlug" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "VehicleTrim_modelId_year_idx" ON "VehicleTrim"("modelId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTrim_modelId_year_variantSlug_key" ON "VehicleTrim"("modelId", "year", "variantSlug");
