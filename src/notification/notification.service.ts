// src/notification/notification.service.ts
import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { OnEvent } from '@nestjs/event-emitter'; // Import OnEvent and EventEmitter2
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service'; // To fetch user's FCM tokens
import * as admin from 'firebase-admin'; // Firebase Admin SDK
import { Notification, NotificationDocument } from './notification.schema';
import { NotificationType } from '../common/enums/notification-enum';
import { FirebaseService } from '../firebase/firebase.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PromotionTargetAudience, SendPromotionalNotificationDto } from './dtos/send-promotional-notification.dto';
import { BookingService } from '../booking/booking.service';
import { BookingCreatedEvent, BookingStatusUpdatedEvent } from '../booking/booking.events'; // Import event classes
import { BookingStatus } from '../common/enums/booking-status.enum';
import moment from 'moment-timezone';
import { SportClubUpdatedEvent } from '../sport-club/sport-club.events';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private readonly MAX_PUSH_RETRIES = 3; // Max attempts for transient failures
    private readonly RETRY_DELAYS_MS = [
        1 * 60 * 1000, // 1 minute
        5 * 60 * 1000, // 5 minutes
        15 * 60 * 1000, // 15 minutes
    ];

    constructor(
        @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
        private readonly usersService: UsersService,
        private readonly bookingService: BookingService,
        private firebaseService: FirebaseService // Injected Firebase Admin SDK instance
    ) { }

    /**
    * Helper to update the push notification status in the database.
    */
    private async _updatePushNotificationStatus(
        notificationId: Types.ObjectId,
        status: string,
        error?: string,
        incrementRetry: boolean = false,
    ): Promise<void> {
        const update: any = {
            pushStatus: status,
            lastPushAttemptAt: new Date(),
        };
        if (error) {
            update.lastPushError = error;
        }
        if (incrementRetry) {
            update.$inc = { pushRetryCount: 1 };
        }

        try {
            await this.notificationModel.findByIdAndUpdate(notificationId, update).exec();
        } catch (dbError) {
            this.logger.error(`Failed to update notification status for ${notificationId}: ${dbError.message}`, dbError.stack);
        }
    }

    /**
     * Creates an in-app notification record and initiates a push notification attempt.
     *
     * @param recipientId The MongoDB ObjectId (or string) of the user who will receive the notification.
     * @param title The title of the notification.
     * @param message The detailed message content.
     * @param type The category of the notification.
     * @param relatedEntityId (Optional) The ID of the entity related to the notification.
     * @param relatedEntityType (Optional) The collection name of the related entity.
     * @param pushData (Optional) Custom data payload for the push notification.
     * @returns The created Notification document.
     */
    async createNotification(
        recipientId: Types.ObjectId | string,
        title: string,
        message: string,
        type: NotificationType,
        relatedEntityId?: Types.ObjectId | string,
        relatedEntityType?: string,
        pushData?: Record<string, any>, // Renamed to pushData for clarity
    ): Promise<Notification> {
        const newNotification = new this.notificationModel({
            recipient: new Types.ObjectId(recipientId),
            title,
            message,
            type,
            relatedEntityId: relatedEntityId ? new Types.ObjectId(relatedEntityId) : undefined,
            relatedEntityType,
            isRead: false,
            data: pushData || {}, // Store optional data payload
            pushStatus: 'pending', // Initial status for push notification
            pushRetryCount: 0,
            lastPushAttemptAt: null,
            lastPushError: null,
        });

        try {
            const createdNotification = await newNotification.save();
            this.logger.debug(`In-app notification created for user ${recipientId}: ${title}`);

            // Immediately attempt to send push notification
            // Pass the created notification's _id for status updates
            this.sendPushNotification(
                createdNotification.recipient.toString(), // Pass recipient's local ID
                createdNotification.title,
                createdNotification.message,
                createdNotification.data,
                createdNotification.id // Pass the notification ID for status tracking
            );

            return createdNotification;
        } catch (error) {
            this.logger.error(`Failed to create in-app notification for ${recipientId}: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Sends a push notification to a user's device(s) via Firebase Cloud Messaging (FCM).
     * This method now also updates the notification's push status in the DB.
     *
     * @param recipientLocalId The local MongoDB User ID of the recipient.
     * @param title The title of the push notification.
     * @param body The main message body of the push notification.
     * @param data (Optional) Custom data payload for the notification.
     * @param notificationDbId (Optional) The MongoDB _id of the notification record to update its pushStatus.
     */
    async sendPushNotification(
        recipientLocalId: string, // Changed to local ID to fetch user
        title: string,
        body: string,
        data?: { [key: string]: string },
        notificationDbId?: Types.ObjectId, // New parameter
    ): Promise<void> {
        let userFirebaseUid: string | undefined;
        try {
            const user = await this.usersService.findById(recipientLocalId); // Fetch user by local ID
            if (!user || !user.uid || !user.fcmTokens || user.fcmTokens.length === 0) {
                this.logger.warn(`No Firebase UID or FCM tokens found for user ${recipientLocalId}. Push notification not sent.`);
                if (notificationDbId) {
                    await this._updatePushNotificationStatus(notificationDbId, 'failed', 'No FCM tokens or Firebase UID found.', true);
                }
                return;
            }
            userFirebaseUid = user.uid; // Store for logging

            const validTokens = user.fcmTokens.filter(token => token && token.length > 0);
            if (validTokens.length === 0) {
                this.logger.warn(`No valid FCM tokens for user ${recipientLocalId} after filtering. Push notification not sent.`);
                if (notificationDbId) {
                    await this._updatePushNotificationStatus(notificationDbId, 'failed', 'No valid FCM tokens after filtering.', true);
                }
                return;
            }

            const message: admin.messaging.MulticastMessage = {
                notification: { title, body },
                data: data,
                tokens: validTokens,
            };

            // Update status to 'retrying' if it's a retry attempt, otherwise it's 'pending' -> 'sent'
            if (notificationDbId) {
                await this._updatePushNotificationStatus(notificationDbId, 'retrying'); // Mark as retrying before sending
            }

            const response = await this.firebaseService.getAdmin().messaging().sendEachForMulticast(message);

            this.logger.log(`FCM push notification sent. Success: ${response.successCount}, Failure: ${response.failureCount} for user ${recipientLocalId}`);

            if (response.failureCount > 0) {
                const tokensToRemove: string[] = [];
                let transientErrorOccurred = false;
                let lastErrorMessage = '';

                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const token = validTokens[idx];
                        lastErrorMessage = resp.error?.message || 'Unknown FCM error';
                        this.logger.error(`Failed to send to token ${token}: ${lastErrorMessage}`);

                        // Permanent errors: Token is invalid/unregistered. Remove it.
                        if (resp.error?.code === 'messaging/invalid-argument' ||
                            resp.error?.code === 'messaging/registration-token-not-registered' ||
                            resp.error?.code === 'messaging/not-found') {
                            tokensToRemove.push(token);
                        } else {
                            // Other errors are considered transient for retry
                            transientErrorOccurred = true;
                        }
                    }
                });

                // Clean up invalid tokens from the user's record
                if (tokensToRemove.length > 0) {
                    await this.usersService.removeFcmTokens(recipientLocalId, tokensToRemove);
                    this.logger.warn(`Removed ${tokensToRemove.length} invalid FCM tokens for user ${recipientLocalId}.`);
                }

                // Update notification status based on overall outcome
                if (notificationDbId) {
                    if (transientErrorOccurred) {
                        await this._updatePushNotificationStatus(notificationDbId, 'failed', lastErrorMessage, true); // Increment retry count
                    } else {
                        // All failures were permanent, or no tokens left after removal
                        await this._updatePushNotificationStatus(notificationDbId, 'exhausted', 'All tokens invalid or removed.');
                    }
                }
            } else {
                // All messages sent successfully
                if (notificationDbId) {
                    await this._updatePushNotificationStatus(notificationDbId, 'sent');
                }
            }

        } catch (error) {
            this.logger.error(`Unhandled error sending push notification to user ${recipientLocalId}: ${error.message}`, error.stack);
            if (notificationDbId) {
                await this._updatePushNotificationStatus(notificationDbId, 'failed', error.message, true); // Increment retry count
            }
        }
    }

    /**
     * Periodically processes failed push notifications for retry.
     * This method should be called by a cron job or a queue worker.
     */
    async processFailedPushNotifications(): Promise<void> {
        this.logger.log('Starting process for failed push notifications...');
        const now = new Date();

        // Find notifications that have failed and are eligible for retry
        const failedNotifications = await this.notificationModel.find({
            pushStatus: 'failed',
            pushRetryCount: { $lt: this.MAX_PUSH_RETRIES },
            // Check if enough time has passed since the last attempt
            // For simplicity, we use a fixed delay per retry count.
            // A more sophisticated approach would store the next retry time.
            lastPushAttemptAt: {
                $ne: null,
                $lte: new Date(now.getTime() - (this.RETRY_DELAYS_MS[0] || 0)) // Check against first delay as minimum
            }
        }).exec();

        this.logger.log(`Found ${failedNotifications.length} failed notifications to process.`);

        for (const notification of failedNotifications) {
            // Calculate next retry delay based on current retry count
            const delay = this.RETRY_DELAYS_MS[notification.pushRetryCount];
            if (
                delay === undefined ||
                !notification.lastPushAttemptAt ||
                notification.lastPushAttemptAt.getTime() + delay > now.getTime()
            ) {
                // Not yet time for this retry, or max retries reached
                continue;
            }

            this.logger.log(`Retrying push notification ${notification._id} (Attempt ${notification.pushRetryCount + 1}).`);

            try {
                // Re-attempt sending the push notification
                await this.sendPushNotification(
                    notification.recipient.toString(),
                    notification.title,
                    notification.message,
                    notification.data,
                    notification.id // Pass the notification ID for status updates
                );
            } catch (error) {
                this.logger.error(`Error during retry attempt for notification ${notification._id}: ${error.message}`);
                // Status update is handled within sendPushNotification
            }
        }

        // Mark notifications that have exhausted all retries
        await this.notificationModel.updateMany(
            {
                pushStatus: 'failed',
                pushRetryCount: { $gte: this.MAX_PUSH_RETRIES },
            },
            {
                $set: { pushStatus: 'exhausted', lastPushError: 'Max retries exhausted.' },
            },
        ).exec();

        this.logger.log('Finished processing failed push notifications.');
    }

    /**
     * Event listener for booking creation.
     * Creates an in-app notification for the user.
     */
    @OnEvent('booking.created')
    async handleBookingCreatedEvent(payload: BookingCreatedEvent) {
        const { booking, service } = payload;
        // 6. Trigger Notification to Club Owner
        // Fetch club owner's Firebase UID for push notification
        const clubOwners = await this.usersService.findClubOwners(booking.club.toString()); // booking.club should be the club's ID string
        if (clubOwners.length > 0) { // If any owner is found
            const clubOwner = clubOwners[0];
            // Create an in-app notification, which will also trigger the push notification
            await this.createNotification(
                clubOwner.id,
                'New Booking Request!',
                `New booking for ${service?.name} (${moment(booking.bookingDate).format('MMM D')}, ${booking.startTime}-${booking.endTime}).`,
                NotificationType.BookingPending,
                booking.id, // relatedEntityId
                'Booking',    // relatedEntityType
                { bookingId: booking.id.toString(), type: 'new_booking', href: '/dashboard/owner' } // pushData
            );
        }
    }

    /**
     * Event listener for booking status updates.
     * Can trigger notifications based on the new status.
     */
    @OnEvent('booking.status_updated')
    async handleBookingStatusUpdatedEvent(payload: BookingStatusUpdatedEvent) {
        const { bookingId, newStatus, booking } = payload;
        this.logger.debug(`Handling booking.status_updated event for booking ${bookingId} with status ${newStatus}.`);

        // Fetch the full booking if not fully populated or to ensure latest state
        // const booking = bookingFromEvent && bookingFromEvent.populated('customer') && bookingFromEvent.populated('club') && bookingFromEvent.populated('service')
        //     ? bookingFromEvent
        //     : await this.bookingService.findById(bookingId.toString()).populate('customer').populate('club').populate('service').exec();

        if (!booking) {
            this.logger.error(`Booking ${bookingId} not found for status update notification.`);
            return;
        }

        const customer = booking.customer as any; // Assuming customer is populated and has an ID
        const club = booking.club as any; // Assuming club is populated and has an owner ID
        const service = booking.service as any; // Assuming service is populated

        if (!customer || !club || !service) {
            this.logger.error(`Missing customer, club, or service details for booking ${bookingId}. Cannot send status update notification.`);
            return;
        }

        let recipientId: string | Types.ObjectId | undefined;
        const extras: Record<string, any> = {};
        let title: string = '';
        let message: string = '';
        let notificationType: NotificationType | undefined;

        switch (newStatus) {
            case BookingStatus.Confirmed:
                recipientId = customer.id;
                title = 'Booking Confirmed!';
                message = `Your booking for ${service.name} on ${moment(booking.bookingDate).format('MMM D, YYYY')} at ${booking.startTime} has been confirmed.`;
                notificationType = NotificationType.BookingConfirmed;
                extras['href'] = '/dashboard/user'
                break;
            case BookingStatus.CancelledByClub:
                recipientId = customer.id; // Notify customer
                title = 'Booking Cancelled by Club';
                message = `Your booking for ${service.name} on ${moment(booking.bookingDate).format('MMM D, YYYY')} at ${booking.startTime} has been cancelled by the club.`;
                notificationType = NotificationType.BookingCancelled; // Or a more specific type if you add one
                extras['href'] = '/dashboard/user'
                break;
            case BookingStatus.CancelledByCustomer:
                recipientId = club.owner; // Notify club owner
                title = 'Booking Cancelled';
                message = `The booking by ${customer.email} for ${service.name} on ${moment(booking.bookingDate).format('MMM D, YYYY')} at ${booking.startTime} has been cancelled by the customer.`;
                notificationType = NotificationType.BookingCancelled; // Or a more specific type
                extras['href'] = '/dashboard/owner'
                break;
            case BookingStatus.Expired:
                recipientId = customer.id; // Notify customer
                title = 'Booking Expired';
                message = `Your booking for ${service.name} on ${moment(booking.bookingDate).format('MMM D, YYYY')} at ${booking.startTime} has expired.`;
                notificationType = NotificationType.BookingExpired;
                extras['href'] = '/dashboard/user'
                break;

            // Add more cases for other statuses like 'completed', 'no_show' if needed
            // For example, if BookingStatus.Pending should also create a notification:
            // case BookingStatus.Pending:
            //     recipientId = club.owner;
            //     title = 'New Booking Pending';
            //     message = `A new booking for ${service.name} is pending your approval.`;
            //     notificationType = NotificationType.BookingPending;
            //     break;
        }

        if (recipientId && title && message && notificationType) {
            await this.createNotification(recipientId, title, message, notificationType, booking.id, 'Booking', extras);
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
     * Fetches a user's notifications from the past week from the database.
     * @param userId The ID of the user whose notifications to retrieve.
     * @param limit (Optional) Maximum number of notifications to return.
     * @param skip (Optional) Number of notifications to skip for pagination.
     * @returns An array of Notification documents.
     */
    async getWeeklyNotificationsForUser(
        userId: string,
        limit: number = 20,
        skip: number = 0,
    ): Promise<Notification[]> {
        const oneWeekAgo = moment().subtract(7, 'days').toDate();
        const query: any = {
            recipient: new Types.ObjectId(userId),
            createdAt: { $gte: oneWeekAgo },
        };

        return this.notificationModel.find(query)
            .sort({ createdAt: -1 }) // Sort by latest first
            .skip(skip)
            // .limit(limit)
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
        try {
            if (!notificationIds || notificationIds.length === 0) {
                throw new BadRequestException('No notification IDs provided to mark as read.');
            }
            if (!Types.ObjectId.isValid(userId)) {
                throw new BadRequestException('Invalid user ID format.');
            }
        } catch (error) {
            this.logger.error(`Error validating input for markNotificationsAsRead: ${error.message}`, error.stack);
            throw error; // Re-throw to be handled by global exception filter
        }
        const objectIds = notificationIds.map(id => {
            try {
                return new Types.ObjectId(id)
            } catch (error) {
                this.logger.error(`Invalid notification ID format: ${id}`, error.stack);
            }
        }).filter(Boolean); // Filter out any invalid IDs
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

    // This will run every 5 minutes (adjust as needed)
    @Cron(CronExpression.EVERY_30_MINUTES)
    async handleCron() {
        this.logger.debug('Cron job triggered for processing failed push notifications.');

        // Preliminary check to see if there are any notifications that might need processing
        const potentiallyProcessableCount = await this.notificationModel.countDocuments({
            pushStatus: 'failed',
            pushRetryCount: { $lt: this.MAX_PUSH_RETRIES },
        }).exec();

        if (potentiallyProcessableCount === 0) {
            this.logger.debug('No failed notifications eligible for retry. Skipping full process.');
            return;
        }

        await this.processFailedPushNotifications();
    }

    /**
   * Sends bulk promotional notifications to targeted users.
   * This method is designed to be called by a controller endpoint (e.g., by a club owner).
   * It should ideally be wrapped in a queue job for large audiences.
   *
   * @param ownerId The local MongoDB ID of the club owner sending the promotion.
   * @param clubId The ID of the club sending the promotion (for 'club_customers' target).
   * @param promoDto The DTO containing promotional message and targeting options.
   */
    async sendBulkPromotionalNotification(
        ownerId: string,
        clubId: string,
        promoDto: SendPromotionalNotificationDto,
    ): Promise<{ message: string; totalRecipients: number; notificationsSent: number }> {
        const { title, message, targetAudience, actionUrl, targetCity, targetSportType } = promoDto;

        let recipientUserIds: Types.ObjectId[] = [];
        const queryConditions: any = { receivePromotions: true };
        // 1. Determine target audience based on `targetAudience`
        switch (targetAudience) {
            case PromotionTargetAudience.AllUsers:
                // For 'all_users', fetch all users who opted-in for promotions
                const allUsers = await this.usersService.findByQuery({ receivePromotions: true });
                recipientUserIds = allUsers.map(user => user.id);
                break;

            case PromotionTargetAudience.ClubCustomers:
                // Find all unique customer IDs who have booked at this specific club
                const bookingsForClub = await this.bookingService.findDistinctCustomersId({
                    club: new Types.ObjectId(clubId),
                    status: { $in: ['confirmed', 'completed'] } // Only confirmed/completed bookings
                }); // Get unique customer IDs

                // Filter these customers to only include those who receive promotions
                const clubCustomers = await this.usersService.findByQuery({
                    _id: { $in: bookingsForClub },
                    receivePromotions: true
                });
                recipientUserIds = clubCustomers.map(user => user.id);
                break;
            case PromotionTargetAudience.City: // <-- NEW TARGETING LOGIC
                if (!targetCity || targetCity.trim() === '') {
                    throw new BadRequestException('targetCity is required when targeting by city.');
                }
                queryConditions['address.city'] = { $regex: new RegExp(`^${targetCity.trim()}$`, 'i') }; // Case-insensitive exact match
                // You might want to also ensure address.city exists if it's optional in schema
                queryConditions['address.city'] = { $exists: true, $ne: null, $regex: new RegExp(`^${targetCity.trim()}$`, 'i') };
                break;

            // Add more targeting options here if needed (e.g., by sport type, location)
            case PromotionTargetAudience.SportInterest:
                // This would require a 'sportInterests' array in User schema or complex joins
                if (!targetSportType) throw new BadRequestException('targetSportType is required for sport_interest audience.');
                // Logic to find users interested in targetSportType
                break;

            default:
                throw new BadRequestException('Invalid target audience specified.');
        }

        if (recipientUserIds.length === 0) {
            return {
                message: 'No eligible recipients found for this promotional notification.',
                totalRecipients: 0,
                notificationsSent: 0,
            };
        }

        this.logger.log(`Initiating bulk promotional notification for ${recipientUserIds.length} recipients.`);

        let notificationsSentCount = 0;
        const customData: Record<string, string> = {
            type: NotificationType.Promotional,
            clubId: clubId, // Include club ID in data
        };
        if (actionUrl) {
            customData.actionUrl = actionUrl;
        }

        // --- Queueing / Batching Logic (Conceptual) ---
        // For a real application, you'd add jobs to a queue here instead of direct iteration.
        // Example:
        // const jobs = recipientUserIds.map(recipientId => ({
        //   recipientId: recipientId.toString(),
        //   title,
        //   message,
        //   type: NotificationType.Promotional,
        //   pushData: customData,
        // }));
        // await this.notificationQueue.addBulk(jobs); // Add all jobs to queue

        // For this example, we'll iterate and call createNotification directly,
        // but be aware of API timeouts for very large lists.
        for (const recipientId of recipientUserIds) {
            try {
                // createNotification will handle saving to DB and attempting push notification
                await this.createNotification(
                    recipientId,
                    title,
                    message,
                    NotificationType.Promotional,
                    undefined, // No related entity ID for general promotions
                    undefined, // No related entity type
                    customData, // Pass custom data for push notifications
                );
                notificationsSentCount++;
            } catch (error) {
                this.logger.error(`Failed to send promotional notification to user ${recipientId}: ${error.message}`);
                // Continue processing other notifications even if one fails
            }
        }

        this.logger.log(`Bulk promotional notification process completed. Sent to ${notificationsSentCount} recipients.`);

        return {
            message: 'Promotional notification process initiated. Notifications will be sent in the background.',
            totalRecipients: recipientUserIds.length,
            notificationsSent: notificationsSentCount,
        };
    }

    /**
   * Sends a notification to specified users about a club data change.
   * @param userIds - Array of user IDs (local DB IDs) to notify.
   * @param clubId - The ID of the club that was updated.
   * @param clubName - The name of the club.
   * @param notificationTitle - The title of the notification.
   * @param notificationBody - The body/message of the notification.
   */
    async sendClubUpdateNotification(
        city: string,
        clubId: string,
        clubName: string,
        notificationTitle: string,
        notificationBody: string,
    ): Promise<void> {
        const userList = await this.usersService.findByQuery({ currentLocation: city })
        if (!userList || userList.length === 0) {
            this.logger.log('No user IDs provided for club update notification.');
            return;
        }

        const fcmTokens: string[] = [];
        for (const user of userList) {
            if (user && user.fcmTokens && user.fcmTokens.length > 0) {
                fcmTokens.push(...user.fcmTokens);
            } else {
                this.logger.warn(`User ${user.id} has no FCM tokens or was not found, skipping for club update notification.`);
            }
        }

        if (fcmTokens.length === 0) {
            this.logger.log(`No FCM tokens found for the provided user IDs for club ${clubName} (ID: ${clubId}).`);
            return;
        }

        const uniqueFcmTokens = [...new Set(fcmTokens)]; // Ensure unique tokens

        const message: admin.messaging.MulticastMessage = {
            notification: {
                title: notificationTitle,
                body: notificationBody,
            },
            data: {
                clubId: clubId,
                clubName: clubName,
                type: 'CLUB_DATA_UPDATED', // Custom data to help client app handle notification
            },
            tokens: uniqueFcmTokens,
        };

        try {
            const response = await this.firebaseService.getAdmin().messaging().sendEachForMulticast(message);
            this.logger.log(`Successfully sent club update notification to ${response.successCount} device(s) for club "${clubName}" (ID: ${clubId}).`);
            if (response.failureCount > 0) {
                this.logger.warn(`Failed to send club update notification to ${response.failureCount} device(s) for club "${clubName}" (ID: ${clubId}).`);
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        this.logger.error(`Error sending to token ${uniqueFcmTokens[idx]}: ${resp.error?.code} - ${resp.error?.message}`);
                        // Consider implementing logic to handle/remove invalid tokens based on error codes like 'messaging/registration-token-not-registered'
                    }
                });
            }
        } catch (error) {
            this.logger.error(`Error sending club update multicast message for club "${clubName}" (ID: ${clubId}):`, error);
        }
    }

    /**
     * Event listener for booking status updates.
     * Can trigger notifications based on the new status.
     */
    @OnEvent('club.updated')
    async handleClubUpdatedEvent(payload: SportClubUpdatedEvent) {
        const { sportClub } = payload
        this.logger.debug(`Handling booking.status_updated event for booking ${sportClub.name}.`);
        await this.sendClubUpdateNotification(
            sportClub.address.city?.toString(), // Ensure city is a string
            sportClub.id,
            sportClub.name,
            `Club Update: ${sportClub.name}`,
            `The details for ${sportClub.name} have been updated. Check them out!`
        );
    }
}