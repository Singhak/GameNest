// src/users/dto/update-fcm-token.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}