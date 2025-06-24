export enum BookingStatus {
    Pending = 'pending', // Awaiting club owner confirmation
    Confirmed = 'confirmed', // Confirmed by club owner
    CancelledByCustomer = 'cancelled_by_customer',
    CancelledByClub = 'cancelled_by_club',
    Completed = 'completed', // Booking time has passed and was fulfilled
    NoShow = 'no_show', // Customer did not show up
    Rescheduled = 'rescheduled',
    CancelledRescheduled='cancelled_rescheduled',
    ReschedulePending='reschedule_pending',
    RescheduleRequested='reschedule_requested',
    Rejected = 'rejected',
}