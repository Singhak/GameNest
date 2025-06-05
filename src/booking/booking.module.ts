// src/booking/booking.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { NotificationModule } from '../notification/notification.module'; // Import NotificationModule
import { UsersModule } from '../users/users.module'; // Import UsersModule
import { Booking, BookingSchema } from './booking.schema';
import { SportService, SportServiceSchema } from 'src/sport-service/sport-service.schema';
import { SportClubModule } from 'src/sport-club/sport-club.module';
import { SportServiceModule } from 'src/sport-service/sport-service.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
    ]),
    forwardRef(() => NotificationModule), 
    forwardRef(() => UsersModule), 
    forwardRef(() => SportServiceModule), 
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService], // Export if other modules need to use it (e.g., owner-bookings module)
})
export class BookingModule { }