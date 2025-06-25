export enum NotificationType {
    BookingPending = 'booking_pending',
    BookingConfirmed = 'booking_confirmed',
    BookingRejected = 'booking_rejected',
    BookingCancelled = 'booking_cancelled',
    ReviewReceived = 'review_received',
    SystemMessage = 'system_message',
    BookingExpired = 'booking_expired', // New: For expired bookings
    Promotional = 'promotional',
}