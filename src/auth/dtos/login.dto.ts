import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string; // Firebase ID token from the client
  @IsString()
  currentLocation: string
  @IsString()
  clientInstanceId: string
}