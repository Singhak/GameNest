import { Module } from '@nestjs/common';
import { SportServiceService } from './sport-service.service';
import { SportServiceController } from './sport-service.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { SportService, SportServiceSchema } from './sport-service.schema';
import { SportClub, SportClubSchema } from 'src/sport-club/sport-club.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SportService.name, schema: SportServiceSchema },
      { name: SportClub.name, schema: SportClubSchema }
    ]),
  ],
  providers: [SportServiceService],
  controllers: [SportServiceController],
  exports: [SportServiceService],
})
export class SportServiceModule {}
