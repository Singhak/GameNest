// src/notification/notification.service.ts
import { Injectable, Inject, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service'; // To fetch user's FCM tokens
import * as admin from 'firebase-admin'; // Firebase Admin SDK
import { Notification, NotificationDocument } from './notification.schema';
import { NotificationType } from 'src/common/enums/notification-enum';
import { FirebaseService } from 'src/firebase/firebase.service';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
        private readonly usersService: UsersService, // Injected to get user's FCM tokens (assuming UsersService provides findByFirebaseUid)
       private firebaseService: FirebaseService // Injected Firebase Admin SDK instance
    ) { }

    /**
     * Creates an in-app notification record in the database.
     * This is used for displaying notifications within the application (e.g., in a notification center).
     *
     * @param recipientId The MongoDB ObjectId (or string) of the user who will receive the notification.
     * @param title The title of the notification.
     * @param message The detailed message content.
     * @param type The category of the notification (e.g., 'booking_pending', 'system_message').
     * @param relatedEntityId (Optional) The ID of the entity related to the notification (e.g., booking ID).
     * @param relatedEntityType (Optional) The collection name of the related entity (e.g., 'Booking', 'Review').
     * @param data (Optional) Additional key-value pairs to store with the notification (useful for push notification payloads).
     * @returns The created Notification document.
     */
    async createNotification(
        recipientId: Types.ObjectId | string,
        title: string,
        message: string,
        type: NotificationType, // Using the enum for better type safety
        relatedEntityId?: Types.ObjectId | string,
        relatedEntityType?: string,
        data?: Record<string, any>,
    ): Promise<Notification> {
        const newNotification = new this.notificationModel({
            recipient: new Types.ObjectId(recipientId),
            title,
            message,
            type,
            relatedEntityId: relatedEntityId ? new Types.ObjectId(relatedEntityId) : undefined,
            relatedEntityType,
            isRead: false,
            data: data || {}, // Store optional data payload
        });

        try {
            const createdNotification = await newNotification.save();
            this.logger.debug(`In-app notification created for user ${recipientId}: ${title}`);
            return createdNotification;
        } catch (error) {
            this.logger.error(`Failed to create in-app notification for ${recipientId}: ${error.message}`, error.stack);
            throw error; // Re-throw to allow higher-level error handling
        }
    }

    /**
     * Sends a push notification to a user's device(s) via Firebase Cloud Messaging (FCM).
     * This method relies on user's FCM tokens being stored in your User schema.
     *
     * @param firebaseUid The Firebase User ID (UID) of the recipient.
     * @param title The title of the push notification.
     * @param body The main message body of the push notification.
     * @param data (Optional) Custom data payload for the notification, accessible in the client app.
     */
    async sendPushNotification(
        firebaseUid: string,
        title: string,
        body: string,
        data?: { [key: string]: string }, // FCM data payload must be string key-value pairs
    ): Promise<void> {
        try {
            // 1. Fetch user to get their FCM tokens
            const user = await this.usersService.findByFirebaseUid(firebaseUid); // Assumes UsersService has this method
            if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
                this.logger.warn(`No FCM tokens found for user ${firebaseUid}. Push notification not sent.`);
                return;
            }

            // Filter out any empty or null tokens
            const validTokens = user.fcmTokens.filter(token => token && token.length > 0);
            if (validTokens.length === 0) {
                this.logger.warn(`No valid FCM tokens for user ${firebaseUid} after filtering. Push notification not sent.`);
                return;
            }

            // 2. Construct the FCM message payload
            const message: admin.messaging.MulticastMessage = {
                notification: {
                    title: title,
                    body: body,
                },
                data: data, // Custom data sent to the app
                tokens: validTokens, // Array of device tokens to send to
            };

            // 3. Send the message
            const response = await this.firebaseService.getAdmin().messaging().sendEachForMulticast(message);

            this.logger.log(`FCM push notification sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);

            // 4. Handle failed tokens (optional but recommended for production)
            // This helps clean up invalid or expired tokens from your database
            if (response.failureCount > 0) {
                const tokensToRemove: string[] = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const token = validTokens[idx];
                        this.logger.error(`Failed to send to token ${token}: ${resp.error?.message}`);
                        // Common errors indicating token invalidity:
                        // 'messaging/invalid-argument', 'messaging/registration-token-not-registered'
                        if (resp.error?.code === 'messaging/invalid-argument' || resp.error?.code === 'messaging/registration-token-not-registered') {
                            tokensToRemove.push(token);
                        }
                    }
                });

                if (tokensToRemove.length > 0) {
                    this.logger.warn(`Removing ${tokensToRemove.length} invalid FCM tokens for user ${firebaseUid}.`);
                    // This method needs to be implemented in your UsersService
                    // await this.usersService.removeFcmTokens(user._id.toString(), tokensToRemove);
                }
            }

        } catch (error) {
            this.logger.error(`Error sending push notification to user ${firebaseUid}: ${error.message}`, error.stack);
        }
    }

    /**
     * Fetches a user's notifications from the database.
     * @param userId The ID of the user whose notifications to retrieve.
     * @param isRead (Optional) Filter by read status (true for read, false for unread).
     * @param limit (Optional) Maximum number of notifications to return.
     * @param skip (Optional) Number of notifications to skip for pagination.
     * @returns An array of Notification documents.
     */
    async getNotificationsForUser(
        userId: string,
        isRead?: boolean,
        limit: number = 20,
        skip: number = 0,
    ): Promise<Notification[]> {
        const query: any = { recipient: new Types.ObjectId(userId) };
        if (isRead !== undefined) {
            query.isRead = isRead;
        }

        return this.notificationModel.find(query)
            .sort({ createdAt: -1 }) // Sort by latest first
            .skip(skip)
            .limit(limit)
            .exec();
    }

    /**
     * Marks specific notifications as read.
     * @param notificationIds An array of notification IDs to mark as read.
     * @param userId The ID of the user performing the action (for security/ownership verification).
     * @returns The Mongoose update result.
     * @throws ForbiddenException if a user tries to mark notifications they don't own.
     */
    async markNotificationsAsRead(notificationIds: string[], userId: string): Promise<any> {
        const objectIds = notificationIds.map(id => new Types.ObjectId(id));
        const result = await this.notificationModel.updateMany(
            { _id: { $in: objectIds }, recipient: new Types.ObjectId(userId), isRead: false }, // Only update unread notifications belonging to the user
            { $set: { isRead: true } },
        ).exec();

        if (result.matchedCount === 0 && notificationIds.length > 0) {
            // If no notifications matched, it could be because they don't exist, are already read, or don't belong to the user
            // You might want to fetch and verify one to give a more specific error for unauthorized access
            const testNotification = await this.notificationModel.findById(objectIds[0]).exec();
            if (testNotification && testNotification.recipient.toString() !== userId) {
                throw new ForbiddenException('You do not have permission to mark some of these notifications.');
            }
        }
        return result;
    }

    /**
     * Marks all unread notifications for a specific user as read.
     * @param userId The ID of the user.
     * @returns The Mongoose update result.
     */
    async markAllUserNotificationsAsRead(userId: string): Promise<any> {
        return this.notificationModel.updateMany(
            { recipient: new Types.ObjectId(userId), isRead: false },
            { $set: { isRead: true } },
        ).exec();
    }
}