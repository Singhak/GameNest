import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { SportClub } from '../../sport-club/sport-club.schema';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User extends Document {
    @Prop({ required: true, unique: true, index: true })
    uid: string;

    @Prop({ required: true, unique: true, index: true })
    email: string;

    @Prop({ type: [String], enum: Role, default: [Role.User] })
    roles: Role[];

    @Prop()
    provider: string;

    @Prop()
    name: string;

    @Prop()
    phoneNumber: string;

    @Prop()
    whatsappNumber: string;

    @Prop({ select: false }) // Passwords should not be returned by default
    password: string;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'SportClub' }], default: [] })
    ownedClubs: Types.ObjectId[] | SportClub[];

    @Prop({ type: [{ type: Types.ObjectId, ref: 'SportClub' }], default: [] })
    favoriteClubs: Types.ObjectId[];

    @Prop({ type: Object })
    address: {
        street: String;
        city: String;
        state: String;
        zipCode: String;
        country: String;
    };

    @Prop({ type: [{ tokenHash: String, expiresAt: Date, deviceId: String, issuedAt: Date }], select: false })
    refreshTokens: {
        tokenHash: string;
        expiresAt: Date;
        deviceId?: string;
        issuedAt: Date;
    }[];

    @Prop({ type: [String], default: [] })
    fcmTokens: string[];

    @Prop()
    currentLocation: string;

    @Prop({ type: String, default: null })
    avatar: string; // URL to the user's avatar image
}

export const UserSchema = SchemaFactory.createForClass(User);