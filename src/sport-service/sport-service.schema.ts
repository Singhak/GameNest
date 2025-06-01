import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SportServiceDocument = HydratedDocument<SportService>;

@Schema({ timestamps: true })
export class SportService {
    @Prop({ type: Types.ObjectId, ref: 'SportClub', required: true, index: true })
    club: Types.ObjectId; // Link to the parent club
    @Prop({ required: true })
    name: String; // E.g., "Badminton Court 1", "Table Tennis Arena 2"
    @Prop({ required: true, index: true })
    sportType: String; // E.g., "Badminton", "Table Tennis", "Basketball"
    @Prop({ required: true, default: 0 })
    hourlyPrice: Number;
    @Prop({ required: true, min: 1 })
    capacity: Number; // Max number of players
    @Prop()
    description: String;
    @Prop()
    images: [String]; // Photos of this specific court/service
    @Prop({ default: true })
    isActive: Boolean; // For enabling/disabling a service
    // Operating hours (optional, can be complex if different per day/service)
    // Example: simple daily availability
    @Prop({ enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] })
    availableDays: [String];
    @Prop({ match: /^([01]\d|2[0-3]):([0-5]\d)$/ })
    openingTime: String; // HH:MM format
    @Prop({ match: /^([01]\d|2[0-3]):([0-5]\d)$/ })
    closingTime: String; // HH:MM format

}

export const SportServiceSchema = SchemaFactory.createForClass(SportService);