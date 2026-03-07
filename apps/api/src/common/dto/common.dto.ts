import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class ApiKeyDto {
  @IsString()
  @IsOptional()
  apiKey?: string;
}

export class ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;

  constructor(success: boolean, data?: T, message?: string, error?: string) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.error = error;
  }
}

export class PaginationDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  get pageAsNumber(): number {
    return parseInt(this.page || '1', 10);
  }

  get limitAsNumber(): number {
    return parseInt(this.limit || '10', 10);
  }
}
