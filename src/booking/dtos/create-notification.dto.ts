// src/notification/dto/create-notification.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsMongoId } from 'class-validator';

// Define an enum for clarity and strong typing of notification types
export enum NotificationType {
  BookingPending = 'booking_pending',
  BookingConfirmed = 'booking_confirmed',
  BookingRejected = 'booking_rejected',
  BookingCancelled = 'booking_cancelled',
  ReviewReceived = 'review_received',
  SystemMessage = 'system_message',
}

export class CreateNotificationDto {
  @IsMongoId()
  @IsNotEmpty()
  recipientId: string; // The ID of the user (as a string)

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @IsOptional()
  @IsMongoId()
  relatedEntityId?: string;

  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @IsOptional()
  data?: Record<string, any>; // For extra data in push notifications
}