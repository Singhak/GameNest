import { forwardRef, Module } from '@nestjs/common';
import { SportClubService } from './sport-club.service';
import { SportClubController } from './sport-club.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { SportClub, SportClubSchema } from './sport-club.schema';
import { UsersModule } from 'src/users/users.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SportClub.name, schema: SportClubSchema }]),
    forwardRef(() => UsersModule),
    forwardRef(() => NotificationModule), // Added NotificationModule
  ],
  providers: [SportClubService],
  controllers: [SportClubController],
  exports:[SportClubService]
})
export class SportClubModule {
  
}
