import { Types } from "mongoose";
import { Booking } from "./booking.schema";
import { SportService } from "../sport-service/sport-service.schema";
import { BookingStatus } from "../common/enums/booking-status.enum";

/**
 * Event emitted when a new booking is successfully created.
 */
export class BookingCreatedEvent {
    constructor(public readonly booking: Booking, public readonly service?: SportService) { }
}

/**
 * Event emitted when a booking status is updated (e.g., confirmed, cancelled).
 */
export class BookingStatusUpdatedEvent {
    constructor(
        public readonly bookingId: Types.ObjectId,
        public readonly newStatus: BookingStatus,
        public readonly booking?: Booking // Optional: include updated booking object
    ) { }
}

// Add other booking-related events as needed (e.g., BookingCancelledEvent, BookingCompletedEvent)