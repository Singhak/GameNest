// src/owner-clubs/dto/send-promotional-notification.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, ArrayMinSize, IsMongoId } from 'class-validator';

// Define targeting options for clarity
export enum PromotionTargetAudience {
    AllUsers = 'all_users', // All users on the platform (might need admin role)
    ClubCustomers = 'club_customers', // Users who have booked at this club
    City = "city",
    SportInterest = "sport_interest"
    // Add more as needed: e.g., 'sport_interest', 'location_based'
}

export class SendPromotionalNotificationDto {
    @IsString()
    @IsNotEmpty()
    title: string; // Title of the promotional notification

    @IsString()
    @IsNotEmpty()
    message: string; // Body of the promotional notification

    @IsEnum(PromotionTargetAudience)
    @IsNotEmpty()
    targetAudience: PromotionTargetAudience;

    @IsOptional()
    @IsString()
    // Optional: A URL or deep link for the notification to open
    // This will be part of the 'data' payload for push notifications
    actionUrl?: string;

    @IsOptional()
    @IsString()
    // --- NEW FIELD ---
    @IsNotEmpty({ groups: ['cityTargeting'] }) // Required only if targetAudience is 'city'
    targetCity?: string;

    @IsOptional()
    @IsString()
    // Optional: A specific sport type to target (if targetAudience is 'sport_interest')
    targetSportType?: string;

    // Add more fields if targeting becomes more complex (e.g., min bookings, last active date)
}