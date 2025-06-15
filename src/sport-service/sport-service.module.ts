import { forwardRef, Module } from '@nestjs/common';
import { SportServiceService } from './sport-service.service';
import { SportServiceController } from './sport-service.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { SportService, SportServiceSchema } from './sport-service.schema';
import { SportClubModule } from 'src/sport-club/sport-club.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SportService.name, schema: SportServiceSchema },
    ]),
  ],
  providers: [SportServiceService],
  controllers: [SportServiceController],
  exports: [SportServiceService],
})
export class SportServiceModule {}
