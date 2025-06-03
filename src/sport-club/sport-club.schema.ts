import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type SportClubDocument = HydratedDocument<SportClub>;

@Schema({ timestamps: true })
export class SportClub extends Document {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    owner: Types.ObjectId; // Link to the owning user
    @Prop({ required: true, index: true })
    name: string;
    @Prop({ type: Object, required: true })
    address: {
        street: { type: string, required: true },
        city: { type: string, required: true, index: true }, // Index for city searches
        state: { type: string, required: true },
        zipCode: { type: string, required: true, index: true }, // Index for zip code searches
    }
    // GeoJSON for geospatial queries (e.g., find clubs near me)
    location: {
        type: { type: string, enum: ['Point'], default: 'Point' },
        coordinates: { type: [number], required: true }, // [longitude, latitude]
    };
    @Prop({ required: true })
    description: string;
    @Prop()
    contactEmail: string;
    @Prop({ required: true })
    contactPhone: string;
    @Prop()
    images: [string]; // URLs to club photos
    @Prop()
    amenities: [string]; // E.g., ['Parking', 'Cafe', 'Changing Rooms']
    @Prop({ default: 0 })
    averageRating: number;
    @Prop({ default: 0 })
    reviewCount: number
    @Prop({ default: true })
    isActive: boolean; // For enabling/disabling club listings
    @Prop({ default: false })
    isDeleted: boolean
    @Prop({ default: false })
    isFeatured: boolean

}

export const SportClubSchema = SchemaFactory.createForClass(SportClub);
