// src/notification/dto/create-notification.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsMongoId } from 'class-validator';
import { Types } from 'mongoose';
import { NotificationType } from 'src/common/enums/notification-enum';

// Define an enum for clarity and strong typing of notification types


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