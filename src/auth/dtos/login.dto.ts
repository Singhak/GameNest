import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string; // Firebase ID token from the client
  @IsString()
  @IsOptional()
  currentLocation?: string
  @IsString()
  @IsOptional()
  clientInstanceId?: string
}