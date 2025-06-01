import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from './firebase/firebase.module';
import configuration from './common/configs/configuration';
import { MongooseModule } from '@nestjs/mongoose';
import { SportClubModule } from './sport-club/sport-club.module';
import { SportServiceModule } from './sport-service/sport-service.module';
import { BookingModule } from './booking/booking.module';
import { NotificationController } from './notification/notification.controller';
import { NotificationService } from './notification/notification.service';
import { NotificationModule } from './notification/notification.module';
import { ReviewService } from './review/review.service';
import { ReviewController } from './review/review.controller';
import { ReviewModule } from './review/review.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/gamenext'),
    MongooseModule.forFeature(),
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true, // Makes the ConfigModule available throughout the application
      load: [configuration], // Load our custom configuration
      envFilePath: '.env', // Specify the path to your .env file
    }),
    AuthModule,
    UsersModule,
    FirebaseModule,
    SportClubModule,
    SportServiceModule,
    BookingModule,
    NotificationModule,
    ReviewModule, // Import the Firebase module
  ],
  controllers: [AppController, NotificationController, ReviewController],
  providers: [AppService, NotificationService, ReviewService],
})
export class AppModule { }