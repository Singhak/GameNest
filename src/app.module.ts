import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FirebaseModule } from './firebase/firebase.module';
import { MongooseModule } from '@nestjs/mongoose';
import { SportClubModule } from './sport-club/sport-club.module';
import { SportServiceModule } from './sport-service/sport-service.module';
import { BookingModule } from './booking/booking.module';
import { NotificationModule } from './notification/notification.module';
import { ReviewModule } from './review/review.module';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './common/configs/configuration';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the ConfigModule available throughout the application
      load: [configuration], // Load our custom configuration
      envFilePath: '.env', // Specify the path to your .env file
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('mongodbUri'); // or 'MONGODB_URI' if you kept the raw key
        // const serverApi: any = {
        //   'version': "1",
        //   'strict': true,
        //   'deprecationErrors': true,
        // }
        // console.log(`[AppModule] MongoDB URI: ${uri || 'NOT FOUND'}`);
        return {
          uri,
        };
      },
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    FirebaseModule,
    SportClubModule,
    SportServiceModule,
    BookingModule,
    NotificationModule,
    ReviewModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }