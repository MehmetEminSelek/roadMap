import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { FuelAiController } from './fuel-ai.controller';
import { FuelAiService } from './fuel-ai.service';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [FuelAiController],
  providers: [FuelAiService],
  exports: [FuelAiService],
})
export class FuelAiModule {}
