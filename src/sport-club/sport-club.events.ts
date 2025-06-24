import { SportService } from "src/sport-service/sport-service.schema";
import { SportClub } from "./sport-club.schema";

/**
 * Event emitted when a new booking is successfully created.
 */
export class BookingCreatedEvent {
    constructor(public readonly sportClub: SportClub,  public readonly service?: SportService) { }
}

/**
 * Event emitted when a booking status is updated (e.g., confirmed, cancelled).
 */
export class SportClubUpdatedEvent {
    constructor(
        public readonly sportClub: SportClub,
    ) { }
}

// Add other booking-related events as needed (e.g., BookingCancelledEvent, BookingCompletedEvent)