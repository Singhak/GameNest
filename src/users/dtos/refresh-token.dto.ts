import { IsDateString, IsOptional, IsString } from "class-validator";

export class RefreshTokenEntry {
    @IsString()
    @IsOptional()
    tokenHash: string; // The hashed refresh token itself
    @IsString()
    @IsOptional()
    expiresAt: Date;   // When this specific refresh token expires
    @IsString()
    @IsOptional()
    deviceId?: string; // Optional: Unique ID for the device/session (e.g., generated client-side UUID, or user-agent derived hash)
    @IsDateString()
    @IsOptional()
    issuedAt: Date;    // When this specific refresh token was issued
}