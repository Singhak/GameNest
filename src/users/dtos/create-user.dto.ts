import { IsArray, IsDateString, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { Role } from "src/common/enums/role.enum";

export class CreateUserDto {
    @IsString() @IsNotEmpty() uid: string;
    @IsString() @IsOptional() email: string;
    @IsArray() @IsNotEmpty() roles: Role[];
    @IsString() @IsOptional() provider?: string;
    @IsString() @IsOptional() @MaxLength(100) name?: string;
    @IsString() @IsOptional() phoneNumber?: string;
    @IsString() @IsOptional() whatsappNumber?: string;
    @IsString() @IsOptional() password?: string;
    @IsArray() @IsOptional()
    ownedClubs?: string[];
    @IsObject() @IsOptional()
    address?: {
        street: string,
        city: string, // Index for city searches
        state: string,
        zipCode: string, // Index for zip code searches
    }
    @IsObject() @IsOptional()
    refreshTokens?: {
        tokenHash: string; // The hashed refresh token itself
        expiresAt: Date;   // When this specific refresh token expires
        deviceId?: string; // Optional: Unique ID for the device/session (e.g., generated client-side UUID, or user-agent derived hash)
        issuedAt: Date;    // When this specific refresh token was issued
    }[]; // Can store multiple tokens per device
    @IsString()
    @IsOptional()
    currentLocation?: string
}