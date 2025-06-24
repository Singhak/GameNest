// src/booking/dto/create-booking.dto.ts
import { IsString, IsNotEmpty, IsDateString, IsMongoId, Matches, IsOptional } from 'class-validator';
import { Types } from 'mongoose';

export class CreateBookingDto {
  @IsMongoId()
  @IsNotEmpty()
  serviceId: string; // Mongoose ObjectId string for SportService

  @IsDateString()
  @IsNotEmpty()
  // Ensure the date format is YYYY-MM-DD for consistency when passing from frontend
  // and converting to a proper Date object in backend
  bookingDate: string; // YYYY-MM-DD format (e.g., "2025-06-15")

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be in HH:mm format' })
  startTime: string; // HH:mm (e.g., "10:00")

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'endTime must be in HH:mm format' })
  endTime: string; // HH:mm (e.g., "11:00")

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  rescheduleOf?: Types.ObjectId;

}