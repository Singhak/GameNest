import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookingDocument = HydratedDocument<Booking>;

@Schema({timestamps:true})
export class Booking {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    customer: Types.ObjectId
    @Prop({ type: Types.ObjectId, ref: 'SportClub', required: true, index: true })
    club: Types.ObjectId
    @Prop({ type: Types.ObjectId, ref: 'SportService', required: true, index: true })
    service: Types.ObjectId
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
    @Prop({ enum: ['pending', 'confirmed', 'rejected', 'cancelled_by_customer', 'cancelled_by_owner', 'completed'], default: 'pending', index: true })
    status: String
    @Prop({ enum: ['pending', 'paid', 'refunded'], default: 'pending' })
    paymentStatus: String
    @Prop({})
    paymentIntentId: String
    @Prop({})
    notes: String
}

export const BookingSchema = SchemaFactory.createForClass(Booking);