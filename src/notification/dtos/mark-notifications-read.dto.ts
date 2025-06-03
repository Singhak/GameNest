// src/notification/dto/mark-notifications-read.dto.ts
import { IsArray, IsMongoId } from 'class-validator';

export class MarkNotificationsReadDto {
  @IsArray()
  @IsMongoId({ each: true }) // Validate each item in the array is a MongoId
  notificationIds: string[];
}