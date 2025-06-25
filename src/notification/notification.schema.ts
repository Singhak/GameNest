// src/notification/schemas/notification.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { NotificationType } from 'src/common/enums/notification-enum';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipient: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: String, enum: NotificationType, required: true })
  type: string;

  @Prop({ type: Types.ObjectId, required: false })
  relatedEntityId?: Types.ObjectId;

  @Prop({ type: String, required: false })
  relatedEntityType?: string;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Object })
  data?: Record<string, any>;

  // --- New fields for Push Notification Status and Retry Logic ---
  @Prop({ type: String, enum: ['pending', 'sent', 'failed', 'retrying', 'exhausted'], default: 'pending', index: true })
  pushStatus: string; // Status of the push notification attempt

  @Prop({ type: Number, default: 0 })
  pushRetryCount: number; // How many times we've tried to send this push notification

  @Prop({ type: Date, required: false })
  lastPushAttemptAt?: Date; // Timestamp of the last push attempt

  @Prop({ type: String, required: false })
  lastPushError?: string; // Last error message from FCM if failed
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipient: 1, createdAt: -1 });
// Add index for efficient querying of failed/retrying push notifications
NotificationSchema.index({ pushStatus: 1, lastPushAttemptAt: 1 });