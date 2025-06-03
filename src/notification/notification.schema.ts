// src/notification/schemas/notification.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true }) // Adds createdAt and updatedAt fields automatically
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipient: Types.ObjectId; // The user who receives this notification

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  message: string;

  // Type for categorization (e.g., 'booking_confirmed', 'system_message')
  @Prop({ type: String, enum: ['booking_pending', 'booking_confirmed', 'booking_rejected', 'booking_cancelled', 'review_received', 'system_message'], required: true })
  type: string;

  // Optional: ID of the related entity (e.g., the Booking ID)
  @Prop({ type: Types.ObjectId, required: false })
  relatedEntityId?: Types.ObjectId;

  // Optional: Type of the related entity (e.g., 'Booking', 'Review')
  @Prop({ type: String, required: false })
  relatedEntityType?: string;

  @Prop({ type: Boolean, default: false })
  isRead: boolean; // Flag to track if the user has read it

  @Prop({ type: Object }) // Optional: Additional data for push notification payload (e.g., deep linking info)
  data?: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index for efficient querying of a user's notifications, sorted by creation date
NotificationSchema.index({ recipient: 1, createdAt: -1 });