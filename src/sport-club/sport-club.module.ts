import { Module } from '@nestjs/common';
import { SportClubService } from './sport-club.service';
import { SportClubController } from './sport-club.controller';

@Module({
  providers: [SportClubService],
  controllers: [SportClubController]
})
export class SportClubModule {}
