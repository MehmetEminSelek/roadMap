import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Vehicle } from '@prisma/client';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(createVehicleDto: CreateVehicleDto, userId: string): Promise<Vehicle> {
    return this.prisma.vehicle.create({
      data: {
        userId,
        ...createVehicleDto,
      },
    });
  }

  async findAll(userId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto, userId: string): Promise<Vehicle> {
    await this.findOne(id, userId); // Check ownership

    return this.prisma.vehicle.update({
      where: { id },
      data: { ...updateVehicleDto },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId); // Check ownership

    await this.prisma.vehicle.delete({
      where: { id },
    });
  }

  /**
   * Post-trip kalibrasyon: `actualFuelL / estimatedL` oranını running average
   * ile vehicle.correctionFactor'e katar. İlk 20 örnekten sonra yeni örnekler
   * 1/20 ağırlıkla katılır — aşırı oynama önlenir.
   */
  async updateCorrectionFactor(vehicleId: string, newRatio: number): Promise<void> {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) return;
    const oldFactor = v.correctionFactor ?? 1.0;
    const n = Math.min(20, (v.correctionSampleN ?? 0) + 1);
    const newFactor = (oldFactor * (n - 1) + newRatio) / n;
    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { correctionFactor: newFactor, correctionSampleN: n },
    });
  }

  async getVehicleBrands(): Promise<{ id: string; name: string }[]> {
    return this.prisma.vehicleMake.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  async getVehicleModels(makeId: string): Promise<{ id: string; name: string }[]> {
    const make = await this.prisma.vehicleMake.findUnique({
      where: { id: makeId },
    });

    if (!make) {
      throw new NotFoundException('Vehicle make not found');
    }

    return this.prisma.vehicleModel.findMany({
      where: { makeId },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  async getVehicleTrims(modelId: string): Promise<{
    id: string;
    year: number;
    fuelType: string;
    engineCapacity: number | null;
    transmission: string | null;
    fuelEconomyL100: number | null;
  }[]> {
    const model = await this.prisma.vehicleModel.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      throw new NotFoundException('Vehicle model not found');
    }

    const trims = await this.prisma.vehicleTrim.findMany({
      where: { modelId },
      orderBy: [{ year: 'desc' }, { fuelType: 'asc' }],
      select: {
        id: true,
        year: true,
        fuelType: true,
        engineCapacity: true,
        transmission: true,
        fuelEconomyL100: true,
      },
    });

    // Deduplicate: keep only the latest year for each fuelType + engineCapacity combo
    const seen = new Set<string>();
    return trims.filter((t) => {
      const key = `${t.fuelType}_${t.engineCapacity ?? 'null'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async getVehicleMakesAndModels(): Promise<{ id: string; name: string; models: { id: string; name: string }[] }[]> {
    const makes = await this.prisma.vehicleMake.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return Promise.all(
      makes.map(async (make) => {
        const models = await this.prisma.vehicleModel.findMany({
          where: { makeId: make.id },
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
          },
        });

        return {
          id: make.id,
          name: make.name,
          models,
        };
      }),
    );
  }
}
