import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { RouteStatus } from '@prisma/client';

class RouteQueryDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;

  @IsOptional()
  @Type(() => Number)
  @IsString()
  page?: string;

  @IsOptional()
  @Type(() => Number)
  @IsString()
  limit?: string;
}

export { RouteQueryDto };
