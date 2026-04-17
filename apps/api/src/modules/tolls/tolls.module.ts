import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { TollsController } from './tolls.controller';
import { TollsService } from './tolls.service';
import { TollsCalculatorService } from './tolls-calculator.service';
import { TollGuruService } from './tollguru.service';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [TollsController],
  providers: [TollsService, TollsCalculatorService, TollGuruService],
  exports: [TollsService],
})
export class TollsModule {}
