// src/owner-clubs/dto/create-club.dto.ts
import { IsString, IsNotEmpty, IsArray, IsOptional, IsEmail, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export class CreateClubDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEmail()
  @IsNotEmpty()
  contactEmail: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[]; // URLs

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}