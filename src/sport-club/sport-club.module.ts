import { forwardRef, Module } from '@nestjs/common';
import { SportClubService } from './sport-club.service';
import { SportClubController } from './sport-club.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { SportClub, SportClubSchema } from './sport-club.schema';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SportClub.name, schema: SportClubSchema }]),
    forwardRef(() => UsersModule),
  ],
  providers: [SportClubService],
  controllers: [SportClubController]
})
export class SportClubModule {
  
}
