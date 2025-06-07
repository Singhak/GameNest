// src/booking/booking.service.ts

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from './booking.schema';
import * as moment from 'moment-timezone';
import { CreateBookingDto } from './dtos/create-booking.dto'; // Corrected DTO import
import { SportServiceService } from 'src/sport-service/sport-service.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingCreatedEvent, BookingStatusUpdatedEvent } from './booking.events'; // Import event classes
import { Role } from 'src/common/enums/role.enum';
import { UpdateBookingDto } from './dtos/update-booking.dto';
import { BookingStatus } from 'src/common/enums/booking-status.enum';
import { JwtPayload } from 'src/auth/strategies/jwt.strategy';
@Injectable()
export class BookingService {
    private readonly APP_TIMEZONE = 'Asia/Kolkata'; // Or load from config
    private readonly logger = new Logger(BookingService.name);

    constructor(
        private eventEmitter: EventEmitter2, // Inject EventEmitter2
        @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
        private readonly sportService: SportServiceService,
    ) { }

    async getAvailableSlots(serviceId: string, dateString: string, timezone: string = 'Asia/Kolkata'): Promise<string[]> {
        const service = await this.sportService.findById(serviceId);
        if (!service) {
            throw new NotFoundException('Sport service not found.');
        }
        this.logger.debug(`Getting available slots for service ${serviceId} on ${dateString}`);

        const bookingDate = moment.tz(dateString, 'YYYY-MM-DD', timezone).startOf('day');
        const dayOfWeek = bookingDate.format('ddd'); // E.g., "Mon", "Tue"

        // 1. Check if the service is available on this day
        if (!service.availableDays.includes(dayOfWeek)) {
            return []; // Not available on this day
        }

        const serviceOpeningTime = moment.tz(`${dateString} ${service.openingTime}`, 'YYYY-MM-DD HH:mm', timezone);
        const serviceClosingTime = moment.tz(`${dateString} ${service.closingTime}`, 'YYYY-MM-DD HH:mm', timezone);
        const slotDuration = service.slotDurationMinutes;

        let potentialSlots: { start: moment.Moment; end: moment.Moment; display: string }[] = [];
        let currentTime = serviceOpeningTime.clone();

        // 2. Generate all potential slots for the day
        while (currentTime.isBefore(serviceClosingTime)) {
            let endTime = currentTime.clone().add(Number(slotDuration), 'minutes');
            if (endTime.isAfter(serviceClosingTime)) {
                endTime = serviceClosingTime.clone(); // Handle partial last slot
            }

            potentialSlots.push({
                start: currentTime.clone(),
                end: endTime.clone(),
                display: `${currentTime.format('HH:mm')}-${endTime.format('HH:mm')}`
            });
            currentTime = endTime;
        }

        // 3. Query for existing booked slots
        const bookedBookings = await this.bookingModel.find({
            service: service._id,
            bookingDate: bookingDate.toDate(), // Store as JS Date object
            status: { $in: ['pending', 'confirmed'] },
        }).exec();

        let availableDisplaySlots: string[] = potentialSlots.map(s => s.display);

        // 4. Filter out booked slots
        for (const booking of bookedBookings) {
            const bookedStart = moment.tz(`${dateString} ${booking.startTime}`, 'YYYY-MM-DD HH:mm', timezone);
            const bookedEnd = moment.tz(`${dateString} ${booking.endTime}`, 'YYYY-MM-DD HH:mm', timezone);

            availableDisplaySlots = availableDisplaySlots.filter(displaySlot => {
                const potentialSlot = potentialSlots.find(s => s.display === displaySlot);
                if (!potentialSlot) return true; // Should not happen

                // Check for overlap: [start1, end1) overlaps [start2, end2) if start1 < end2 AND end1 > start2
                // If the potential slot *intersects* with a booked slot, it's not available
                return !(
                    potentialSlot.start.isBefore(bookedEnd) &&
                    potentialSlot.end.isAfter(bookedStart)
                );
            });
        }

        this.logger.debug(`Found ${availableDisplaySlots.length} available slots for service ${serviceId} on ${dateString}`);
        return availableDisplaySlots;
    }

    /**
   * Creates a new booking for a sport service.
   * Includes validation, availability check, and price calculation.
   * @param customerId The MongoDB ObjectId of the customer making the booking.
   * @param createBookingDto The DTO containing booking details.
   * @returns The created Booking document.
   * @throws BadRequestException for invalid booking details/times.
   * @throws NotFoundException if service is not found or inactive.
   * @throws ConflictException if the slot is already booked.
   */
    async createBooking(customerId: string, createBookingDto: CreateBookingDto): Promise<Booking> {
        const { serviceId, bookingDate, startTime, endTime, notes } = createBookingDto;
        this.logger.log(`Attempting to create booking for customer ${customerId}, service ${serviceId} on ${bookingDate} ${startTime}-${endTime}`);

        // 1. Fetch SportService and Club Details
        const service = await this.sportService.findById(serviceId);
        if (!service || !service.isActive) {
            throw new NotFoundException('Sport service not found or is inactive.');
        }
        if (!service.club) {
            throw new NotFoundException('Sport service is not associated with a club.');
        }

        this.logger.debug(`Service found: ${service.name}, Club: ${service.club}`);
        const club = service.club; // The populated club document or ID if not populated

        // 2. Date and Time Validation & Normalization
        const bookingMomentDate = moment.tz(bookingDate, 'YYYY-MM-DD', this.APP_TIMEZONE);
        const dayOfWeek = bookingMomentDate.format('ddd'); // e.g., "Mon"

        // Convert start/end times to moments relative to booking date for easy comparison
        const slotStartMoment = moment.tz(`${bookingDate} ${startTime}`, 'YYYY-MM-DD HH:mm', this.APP_TIMEZONE);
        const slotEndMoment = moment.tz(`${bookingDate} ${endTime}`, 'YYYY-MM-DD HH:mm', this.APP_TIMEZONE);
        const serviceOpeningMoment = moment.tz(`${bookingDate} ${service.openingTime}`, 'YYYY-MM-DD HH:mm', this.APP_TIMEZONE);
        const serviceClosingMoment = moment.tz(`${bookingDate} ${service.closingTime}`, 'YYYY-MM-DD HH:mm', this.APP_TIMEZONE);

        // Basic time validation
        if (!slotStartMoment.isValid() || !slotEndMoment.isValid() || slotStartMoment.isSameOrAfter(slotEndMoment)) {
            this.logger.warn(`Invalid time format or range: ${startTime}-${endTime}`);
            throw new BadRequestException('Invalid start or end time for booking.');
        }

        // Ensure booking is in the future
        if (slotStartMoment.isSameOrBefore(moment.tz(this.APP_TIMEZONE))) {
            this.logger.warn(`Attempted to book in the past: ${bookingDate} ${startTime}`);
            throw new BadRequestException('Bookings can only be made for future slots.');
        }

        // Validate against service's operating hours and days
        if (!service.availableDays.includes(dayOfWeek) ||
            slotStartMoment.isBefore(serviceOpeningMoment) ||
            slotEndMoment.isAfter(serviceClosingMoment) ||
            slotStartMoment.isBefore(serviceOpeningMoment) || // Redundant, but good for clarity
            slotEndMoment.isAfter(serviceClosingMoment)
        ) {
            this.logger.warn(`Service not available at requested time: ${dayOfWeek} ${startTime}-${endTime}`);
            throw new BadRequestException(`Service is not available during the requested time (${dayOfWeek} ${startTime}-${endTime}).`);
        }

        // Validate slot duration matches service's defined slot duration
        const requestedDurationMinutes = slotEndMoment.diff(slotStartMoment, 'minutes');
        if (requestedDurationMinutes % service.slotDurationMinutes !== 0 || requestedDurationMinutes === 0) {
            this.logger.warn(`Invalid duration requested: ${requestedDurationMinutes} minutes, service slot: ${service.slotDurationMinutes}`);
            throw new BadRequestException(`Booking duration must be in multiples of ${service.slotDurationMinutes} minutes and at least one slot.`);
        }
        const durationHours = requestedDurationMinutes / 60;
        if (durationHours === 0) { // Should be caught by previous check, but extra safe
            throw new BadRequestException('Booking duration cannot be zero.');
        }

        // 3. Concurrency Check (Optimistic Locking)
        // Find any existing confirmed or pending bookings that overlap with the requested slot
        const overlappingBookings = await this.bookingModel.findOne({
            service: new Types.ObjectId(serviceId),
            bookingDate: bookingMomentDate.toDate(), // Ensure exact date comparison
            status: { $in: ['pending', 'confirmed'] },
            $or: [
                // Case 1: Existing booking starts within the requested slot
                { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
                // Case 2: Existing booking completely contains the requested slot
                { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
            ],
        }).exec();

        if (overlappingBookings) {
            this.logger.warn(`Slot conflict detected for service ${serviceId} on ${bookingDate} ${startTime}-${endTime}`);
            throw new ConflictException('The requested time slot is already booked or pending confirmation.');
        }

        // 4. Calculate Total Price
        const totalPrice = service.hourlyPrice * durationHours;

        // 5. Create Booking Document
        const newBooking = new this.bookingModel({
            customer: new Types.ObjectId(customerId),
            club: club.id, // Use the actual club ID
            service: new Types.ObjectId(serviceId),
            bookingDate: bookingMomentDate.toDate(), // Store as ISODate in MongoDB
            startTime: startTime,
            endTime: endTime,
            durationHours: durationHours,
            totalPrice: totalPrice,
            status: BookingStatus.Pending, // Default status upon creation
            paymentStatus: 'pending', // Assume payment is pending at creation
            notes: notes,
        });

        const createdBooking = await newBooking.save();
        this.logger.log(`Booking created successfully with ID: ${createdBooking.id}`);

        // 6. Trigger Notification to Club Owner
        // Emit event after successful creation
        this.eventEmitter.emit('booking.created', new BookingCreatedEvent(createdBooking, service));

        return createdBooking;
    }

    async findDistinctCustomersId(query: any = {}): Promise<Types.ObjectId[]> {
        return this.bookingModel.find(query).select('customer').distinct('customer').exec();
    }

    /**
     * Updates an existing booking, primarily its status or notes.
     * @param bookingId The ID of the booking to update.
     * @param updateBookingDto The DTO containing update data.
     * @param currentUser The user performing the update.
     * @returns The updated Booking document.
     */
    async updateBooking(
        bookingId: string,
        updateBookingDto: UpdateBookingDto,
        currentUser: JwtPayload, // Assuming User object from JWT
    ): Promise<Booking> {
        const currentUserId = currentUser.id;
        this.logger.log(`Attempting to update booking ${bookingId} by user ${currentUser}`);
        const bookingObjectId = new Types.ObjectId(bookingId);
        const booking = await this.bookingModel.findById(bookingObjectId)
            .populate('club')
            .populate('customer')
            .populate('service')
            .exec()

        if (!booking) {
            this.logger.warn(`Booking ${bookingId} not found for update.`);
            throw new NotFoundException(`Booking with ID ${bookingId} not found.`);
        }

        const { status: newStatus, notes } = updateBookingDto;

        // Authorization: Who can update what?
        let isClubOwner = false
        let isCustomer = false
        this.logger.debug(`Checking permissions for user ${currentUserId} on booking ${bookingId}`);
        isCustomer = booking.customer && booking.customer.id.toString() === currentUserId;
        if (booking.club && !(booking.club instanceof Types.ObjectId)) {
            isClubOwner = booking.club && booking.club.owner && booking.club.owner.toString() === currentUserId;
        }
        const isAdmin = currentUser.roles.includes(Role.Admin);

        if (newStatus) {
            // Validate status transitions and permissions
            if (isCustomer) {
                if (newStatus === BookingStatus.CancelledByCustomer &&
                    (booking.status === BookingStatus.Pending || booking.status === BookingStatus.Confirmed)) {
                    // Customer can cancel their pending or confirmed bookings
                    booking.status = newStatus;
                } else if (booking.status !== newStatus) { // Allow updating notes without changing status
                    this.logger.warn(`Customer ${currentUser} attempted invalid status transition from ${booking.status} to ${newStatus} for booking ${bookingId}.`);
                    throw new ForbiddenException('You are not allowed to set this booking status.');
                }
            } else if (isClubOwner || isAdmin) {
                // Club owner or Admin can manage statuses more broadly
                if (newStatus === BookingStatus.Confirmed && booking.status === BookingStatus.Pending) {
                    booking.status = newStatus;
                } else if (newStatus === BookingStatus.CancelledByClub &&
                    (booking.status === BookingStatus.Pending || booking.status === BookingStatus.Confirmed)) {
                    booking.status = newStatus;
                } else if (newStatus === BookingStatus.Completed && booking.status === BookingStatus.Confirmed) {
                    // Potentially automated or manual completion
                    booking.status = newStatus;
                } else if (newStatus === BookingStatus.NoShow && booking.status === BookingStatus.Confirmed) {
                    booking.status = newStatus;
                } else if (isAdmin) { // Admin has more leeway
                    booking.status = newStatus;
                } else if (booking.status !== newStatus) {
                    this.logger.warn(`User ${currentUser} (Owner/Admin) attempted invalid status transition from ${booking.status} to ${newStatus} for booking ${bookingId}.`);
                    throw new ForbiddenException(`As a club owner, you cannot set the status from ${booking.status} to ${newStatus}.`);
                }
            } else {
                this.logger.warn(`User ${currentUser} attempted to update status without sufficient permissions for booking ${bookingId}.`);
                throw new ForbiddenException('You do not have permission to update this booking status.');
            }
        }

        if (notes !== undefined) {
            if (isCustomer || isClubOwner || isAdmin) {
                booking.notes = notes;
            } else {
                this.logger.warn(`User ${currentUser} attempted to update notes without sufficient permissions for booking ${bookingId}.`);
                throw new ForbiddenException('You do not have permission to update notes for this booking.');
            }
        }

        if (!newStatus && notes === undefined) {
            this.logger.warn(`Update booking called with no data for booking ${bookingId}.`);
            throw new BadRequestException('No update data provided (status or notes).');
        }

        const updatedBooking = await booking.save();
        this.logger.log(`Booking ${bookingId} updated successfully.`);

        // Emit event if status changed
        if (newStatus && booking.status === newStatus) { // Check if status actually changed to the newStatus
            this.eventEmitter.emit('booking.status_updated', new BookingStatusUpdatedEvent(updatedBooking.id, updatedBooking.status as BookingStatus, booking));
        }

        return updatedBooking;
    }
}