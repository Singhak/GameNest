import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, HydratedDocument, Types } from "mongoose";
import { Role } from "src/common/enums/role.enum";
import { SportClub } from "src/sport-club/sport-club.schema";

export type UserDocument = HydratedDocument<User>;
@Schema({ timestamps: true })
export class User extends Document {
    @Prop() uid: string;
    @Prop() email: string;
    @Prop() roles: Role[];
    @Prop() provider: string;
    @Prop() name: string;
    @Prop() phoneNumber: string;
    @Prop() password: string;
    @Prop({ type: [{ type: Types.ObjectId, ref: 'SportClub' }] })
    ownedClubs: Types.ObjectId[] | SportClub[];
    @Prop({ type: Object })
    address: {
        street: { type: String },
        city: { type: String, required: true }, // Index for city searches
        state: { type: String, required: true },
        zipCode: { type: String, required: true }, // Index for zip code searches
    }
    @Prop({ default: [] })
    refreshTokens: {
        tokenHash: string; // The hashed refresh token itself
        expiresAt: Date;   // When this specific refresh token expires
        deviceId?: string; // Optional: Unique ID for the device/session (e.g., generated client-side UUID, or user-agent derived hash)
        issuedAt: Date;    // When this specific refresh token was issued
    }[]; // Can store multiple tokens per device
    @Prop({ default: [] })
    fcmTokens: string[]; // Firebase Cloud Messaging tokens for push notifications
    @Prop()
    currentLocation: string
}

export const UserSchema = SchemaFactory.createForClass(User)

