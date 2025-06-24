import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import { BookingStatus } from 'src/common/enums/booking-status.enum';
import { SportClub } from 'src/sport-club/sport-club.schema';
import { SportService } from 'src/sport-service/sport-service.schema';
import { User } from 'src/users/schema/user.schema';

export type BookingDocument = HydratedDocument<Booking>;

@Schema({ timestamps: true })
export class Booking extends Document {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    customer: Types.ObjectId | User
    @Prop({ type: Types.ObjectId, ref: 'SportClub', required: true, index: true })
    club: Types.ObjectId | SportClub
    @Prop({ type: Types.ObjectId, ref: 'SportService', required: true, index: true })
    service: Types.ObjectId | SportService
    @Prop({ required: true, index: true })
    bookingDate: Date
    @Prop({ required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ })
    startTime: String
    @Prop({ required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ })
    endTime: String
    @Prop({ required: true, min: 0.5 })
    durationHours: Number
    @Prop({ required: true, min: 0 })
    totalPrice: Number
    @Prop({ enum: BookingStatus, default: BookingStatus.Pending, index: true })
    status: String
    @Prop({ enum: ['pending', 'paid', 'refunded'], default: 'pending' })
    paymentStatus: String
    @Prop({})
    paymentIntentId: String
    @Prop({})
    notes: String
    @Prop({ type: Types.ObjectId, ref: 'Booking', index: true, default: null })
    rescheduleOf?: Types.ObjectId | Booking;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);