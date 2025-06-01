import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ timestamps: true })
export class Review {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    customer: Types.ObjectId
    @Prop({ type: Types.ObjectId, ref: 'SportClub', required: true, index: true })
    club: Types.ObjectId
    @Prop({ min: 1, max: 5 })
    rating: Number
    @Prop()
    comment: String
}

export const ReviewSchema = SchemaFactory.createForClass(Review);