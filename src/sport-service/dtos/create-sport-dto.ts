import { IsArray, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { Types } from "mongoose";

export class CreateSportServiceDto {
    @IsMongoId()
    @IsNotEmpty()
    club: Types.ObjectId // Club ID where this service is offered
    @IsString()
    @IsNotEmpty()
    name: String; // E.g., "Badminton Court 1", "Table Tennis Arena 2"
    @IsString()
    @IsNotEmpty()
    sportType: String; // E.g., "Badminton", "Table Tennis", "Basketball"
    @IsNumber()
    @IsNotEmpty()
    hourlyPrice: Number;
    capacity: Number; // Max number of players
    @IsString()
    @IsOptional()
    description?: String;
    @IsArray()
    @IsNotEmpty()
    images: [String]; // Photos of this specific court/service
    @IsEnum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    @IsArray()
    availableDays?: [String];
    @IsString()
    @IsOptional()
    openingTime?: String; // HH:MM format
    @IsString()
    @IsOptional()
    closingTime?: String; // HH:MM format
}