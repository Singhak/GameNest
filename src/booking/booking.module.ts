// src/booking/booking.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { UsersModule } from '../users/users.module'; // Import UsersModule
import { Booking, BookingSchema } from './booking.schema';
import { SportClubModule } from '../sport-club/sport-club.module';
import { SportServiceModule } from '../sport-service/sport-service.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
    ]),
    forwardRef(() => UsersModule), 
    forwardRef(() => SportServiceModule), 
    forwardRef(() => SportClubModule),
    ScheduleModule.forRoot()
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService], // Export if other modules need to use it (e.g., owner-bookings module)
})
export class BookingModule { }