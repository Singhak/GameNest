import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type SportClubDocument = HydratedDocument<SportClub>;

@Schema({ timestamps: true })
export class SportClub extends Document {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    owner: Types.ObjectId; // Link to the owning user
    @Prop({ required: true, index: true })
    name: String;
    @Prop({ required: true })
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true, index: true }, // Index for city searches
        state: { type: String, required: true },
        zipCode: { type: String, required: true, index: true }, // Index for zip code searches
    }
    // GeoJSON for geospatial queries (e.g., find clubs near me)
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }, // [longitude, latitude]
    };
    @Prop({ required: true })
    description: String;
    @Prop()
    contactEmail: String;
    @Prop({ required: true })
    contactPhone: String;
    @Prop()
    images: [String]; // URLs to club photos
    @Prop()
    amenities: [String]; // E.g., ['Parking', 'Cafe', 'Changing Rooms']
    @Prop({ default: 0 })
    averageRating: Number;
    @Prop({ default: 0 })
    reviewCount: Number
    @Prop({ default: true })
    isActive: Boolean; // For enabling/disabling club listings
    @Prop({ default: false })
    isDeleted: Boolean

}

export const SportClubSchema = SchemaFactory.createForClass(SportClub);
