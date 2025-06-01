import { Module } from '@nestjs/common';
import { SportServiceService } from './sport-service.service';
import { SportServiceController } from './sport-service.controller';

@Module({
  providers: [SportServiceService],
  controllers: [SportServiceController]
})
export class SportServiceModule {}
