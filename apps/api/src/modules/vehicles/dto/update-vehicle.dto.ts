import { PartialType } from '@nestjs/swagger';
import { CreateVehicleDto } from './create-vehicle.dto';

class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}

export { UpdateVehicleDto };
