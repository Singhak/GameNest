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
    MongooseModule.forRootAsync({
      imports: [ConfigModule], // Ensure ConfigModule is available
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('mongodbUri'),
        // You can add other mongoose options here if needed
        // e.g., useNewUrlParser: true,
      }),
      inject: [ConfigService], // Inject ConfigService to use it in the factory
    }),
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true, // Makes the ConfigModule available throughout the application
      load: [configuration], // Load our custom configuration
      envFilePath: '.env', // Specify the path to your .env file
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