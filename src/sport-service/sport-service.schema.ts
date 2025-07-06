import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SportClub } from '../sport-club/sport-club.schema';

export type SportServiceDocument = HydratedDocument<SportService>;

@Schema({ timestamps: true })
export class SportService {
    @Prop({ type: Types.ObjectId, ref: 'SportClub', required: true, index: true })
    club: Types.ObjectId | SportClub; // Link to the parent club
    @Prop({ required: true })
    name: string; // E.g., "Badminton Court 1", "Table Tennis Arena 2"
    @Prop({ required: true, index: true })
    sportType: string; // E.g., "Badminton", "Table Tennis", "Basketball"
    @Prop({ required: true, default: 0 })
    hourlyPrice: number;
    @Prop()
    capacity: number; // Max number of players
    @Prop()
    description: string;
    @Prop()
    images: [string]; // Photos of this specific court/service
    @Prop({ default: true })
    isActive: boolean; // For enabling/disabling a service
    // Operating hours (optional, can be complex if different per day/service)
    // Example: simple daily availability
    @Prop({ type: [String], enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] })
    availableDays: [string];
    @Prop({ match: /^([01]\d|2[0-3]):([0-5]\d)$/ })
    openingTime: string; // HH:MM format
    @Prop({ match: /^([01]\d|2[0-3]):([0-5]\d)$/ })
    closingTime: string; // HH:MM format
    @Prop({ default: 60 })
    slotDurationMinutes: number; // Duration of each booking slot in minutes

}

export const SportServiceSchema = SchemaFactory.createForClass(SportService);