import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TollsController } from './tolls.controller';
import { TollsService } from './tolls.service';

@Module({
  imports: [PrismaModule],
  controllers: [TollsController],
  providers: [TollsService],
  exports: [TollsService],
})
export class TollsModule {}
