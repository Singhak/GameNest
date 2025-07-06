// src/booking/booking.service.ts

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from './booking.schema';
import * as moment from 'moment-timezone';
import { CreateBookingDto } from './dtos/create-booking.dto'; // Corrected DTO import
import { SportServiceService } from '../sport-service/sport-service.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingCreatedEvent, BookingStatusUpdatedEvent } from './booking.events'; // Import event classes
import { Role } from '../common/enums/role.enum';
import { UpdateBookingDto } from './dtos/update-booking.dto';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SportClubService } from '../sport-club/sport-club.service';
@Injectable()
export class BookingService {
    private readonly APP_TIMEZONE = 'Asia/Kolkata'; // Or load from config
    private readonly logger = new Logger(BookingService.name);

    constructor(
        private eventEmitter: EventEmitter2, // Inject EventEmitter2
        @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
        private readonly sportService: SportServiceService,
        private readonly sportClubService: SportClubService,
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
    async createBooking(
        customerId: string,
        createBookingDto: CreateBookingDto,
        initialStatus: BookingStatus = BookingStatus.Pending // Allow overriding initial status
    ): Promise<Booking> {
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
        const newBooking = {
            customer: new Types.ObjectId(customerId),
            club: club, // Use the actual club ID
            service: new Types.ObjectId(serviceId),
            bookingDate: bookingMomentDate.toDate(), // Store as ISODate in MongoDB
            startTime: startTime,
            endTime: endTime,
            durationHours: durationHours,
            totalPrice: totalPrice,
            status: initialStatus, // Use the parameter here
            paymentStatus: 'pending', // Assume payment is pending at creation
            notes: notes,
            rescheduleOf: createBookingDto.rescheduleOf || null,
        };

        const createdBooking = await this.bookingModel.create(newBooking);
        this.logger.log(`Booking created successfully with ID: ${createdBooking.id}`);

        // 6. Trigger Notification to Club Owner
        // Emit event after successful creation
        this.eventEmitter.emit('booking.created', new BookingCreatedEvent(createdBooking, service));

        return createdBooking;
    }

    /**
     * Initiates a reschedule request from a customer.
     * This creates a new 'reschedule_pending' booking and puts the original on hold.
     * @param originalBookingId The ID of the booking to be rescheduled.
     * @param rescheduleDto DTO with the new booking details.
     * @param currentUser The user making the request.
     * @returns The newly created 'reschedule_pending' booking.
     */
    async requestReschedule(
        originalBookingId: string,
        rescheduleDto: CreateBookingDto,
        currentUser: JwtPayload,
    ): Promise<Booking> {
        this.logger.log(`User ${currentUser.id} requesting to reschedule booking ${originalBookingId}`);
        const originalBooking = await this.bookingModel.findById(originalBookingId);

        if (!originalBooking) {
            throw new NotFoundException('Original booking not found.');
        }

        // Authorization: Ensure the current user is the customer of the original booking
        if (originalBooking.customer.toString() !== currentUser.id) {
            throw new ForbiddenException('You can only reschedule your own bookings.');
        }

        // Validation: Check if the original booking is in a state that can be rescheduled
        if (![BookingStatus.Confirmed, BookingStatus.Pending].includes(originalBooking.status as BookingStatus)) {
            throw new BadRequestException(`Booking with status '${originalBooking.status}' cannot be rescheduled.`);
        }

        // 1. Update original booking status to 'reschedule_requested' to put it on hold
        const previousStatus = originalBooking.status;
        originalBooking.status = BookingStatus.RescheduleRequested;
        await originalBooking.save();

        try {
            // 2. Create the new 'reschedule_pending' booking
            const newBookingDto: CreateBookingDto = { ...rescheduleDto, rescheduleOf: originalBooking._id as Types.ObjectId };
            const proposedBooking = await this.createBooking(currentUser.id, newBookingDto, BookingStatus.ReschedulePending);
            return proposedBooking;
        } catch (error) {
            // Rollback: If creating the new booking fails, revert the original booking's status
            this.logger.error(`Failed to create reschedule booking. Reverting original booking ${originalBookingId}. Error: ${error.message}`);
            originalBooking.status = previousStatus;
            await originalBooking.save();
            throw error; // Re-throw the error from createBooking
        }
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
            .populate('rescheduleOf') // Populate the original booking if it's a reschedule request
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
                if (newStatus === BookingStatus.Expired) {
                    const isExpired = await this.isExpireBooking(bookingId);
                    if (isExpired)
                        booking.status = newStatus;
                    else {
                        this.logger.warn(`User ${currentUser} attempted to set booking ${bookingId} to expired from status ${booking.status}.`);
                        throw new ForbiddenException(`You cannot set the status to 'expired' from ${booking.status} for valid booking.`);
                    }
                }
                // Club owner or Admin can manage statuses more broadly
                else if (newStatus === BookingStatus.Confirmed && booking.status === BookingStatus.Pending) {
                    booking.status = newStatus;
                } else if (newStatus === BookingStatus.CancelledByClub &&
                    (booking.status === BookingStatus.Pending || booking.status === BookingStatus.Confirmed)) {
                    booking.status = newStatus;
                } else if (newStatus === BookingStatus.Confirmed && booking.status === BookingStatus.ReschedulePending) {
                    // Owner ACCEPTS reschedule request
                    this.logger.log(`Owner is accepting reschedule request for booking ${bookingId}.`);
                    if (booking.rescheduleOf) {
                        await this.bookingModel.findByIdAndUpdate(booking.rescheduleOf, {
                            status: BookingStatus.CancelledRescheduled
                        });
                        this.logger.log(`Original booking ${booking.rescheduleOf} status updated to 'cancelled_rescheduled'.`);
                    }
                    booking.status = newStatus;
                } else if (newStatus === BookingStatus.Rejected && booking.status === BookingStatus.ReschedulePending) {
                    // Owner REJECTS reschedule request
                    this.logger.log(`Owner is rejecting reschedule request for booking ${bookingId}.`);
                    if (booking.rescheduleOf) {
                        await this.bookingModel.findByIdAndUpdate(booking.rescheduleOf, {
                            status: BookingStatus.Confirmed // Revert original booking to confirmed
                        });
                        this.logger.log(`Original booking ${booking.rescheduleOf} status reverted to 'confirmed'.`);
                    }
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

    /**
     * Retrieves the status of a specific booking.
     * @param bookingId The ID of the booking.
     * @returns The status string of the booking.
     * @throws NotFoundException if the booking is not found.
     */
    async getBookingStatus(bookingId: string): Promise<String> {
        this.logger.log(`Fetching status for booking ID: ${bookingId}`);
        const bookingObjectId = new Types.ObjectId(bookingId);
        const booking = await this.bookingModel.findById(bookingObjectId).select('status').lean().exec();
        if (!booking) {
            throw new NotFoundException(`Booking with ID ${bookingId} not found.`);
        }
        return booking.status;
    }

    /**
     * Retrieves bookings for a specific service on a given date.
     * Only accessible by Admins or the Owner of the club to which the service belongs.
     * @param serviceId The ID of the sport service.
     * @param dateString The date string in 'YYYY-MM-DD' format.
     * @param currentUser The JWT payload of the authenticated user.
     * @returns A list of booking documents.
     */
    async getBookingsByServiceAndDate(
        serviceId: string,
        dateString: string,
    ): Promise<Booking[]> {
        this.logger.log(`Fetching bookings for service ${serviceId} on date ${dateString} by user`);

        // 1. Fetch Service and Validate Ownership/Admin Role
        const service = await this.sportService.findById(serviceId);
        if (!service) {
            throw new NotFoundException(`Service with ID ${serviceId} not found.`);
        }
        if (!service.club) { // service.club is an ObjectId here
            throw new NotFoundException('Service is not associated with a club.');
        }

        const club = await this.sportClubService.findClubById(service.club.toString());
        if (!club) {
            throw new NotFoundException(`Club associated with service ${serviceId} not found.`);
        }

        // 2. Parse Date and Define Range
        const targetDate = moment.tz(dateString, 'YYYY-MM-DD', this.APP_TIMEZONE);
        if (!targetDate.isValid()) {
            throw new BadRequestException('Invalid date format. Please use YYYY-MM-DD.');
        }
        const startDate = targetDate.startOf('day').toDate();
        const endDate = targetDate.endOf('day').toDate();

        // 3. Query Bookings
        return this.bookingModel.find({
            service: new Types.ObjectId(serviceId),
            bookingDate: { $gte: startDate, $lte: endDate },
            status: { $nin: [BookingStatus.CancelledByClub, BookingStatus.CancelledByCustomer, BookingStatus.Rejected] }
        }).sort({ startTime: 'asc' }).lean().exec();
    }

    /**
 * Retrieves bookings for a specific user (customer).
 * @param customerId The ID of the customer.
 * @param status (Optional) Filter bookings by status.
 * @param limit (Optional) Limit the number of results.
 * @param skip (Optional) Skip results for pagination.
 * @returns A list of booking documents.
 */
    async getBookingsForUser(
        customerId: string,
        status?: BookingStatus,
        limit: number = 10,
        skip: number = 0,
    ): Promise<Booking[]> {
        this.logger.log(`Fetching bookings for user ${customerId}, status: ${status}, limit: ${limit}, skip: ${skip}`);
        const query: any = { customer: new Types.ObjectId(customerId) };

        if (status) {
            query.status = status;
        }

        return this.bookingModel.find(query)
            .populate('customer', 'email name phoneNumber uid') // Populate customer with specific fields
            .populate('service', 'name') // Populate service with specific fields
            .populate('club', 'name') // Populate club with specific fields
            .sort({ bookingDate: -1, startTime: -1 }) // Sort by most recent
            .limit(limit)
            .skip(skip)
            .lean()
            .exec();
    }

    /**
     * Retrieves bookings for a specific club, accessible by the club owner or an admin.
     * @param clubId The ID of the sport club.
     * @param currentUser The JWT payload of the authenticated user.
     * @param status (Optional) Filter bookings by status.
     * @param limit (Optional) Limit the number of results.
     * @param skip (Optional) Skip results for pagination.
     * @returns A list of booking documents.
     */
    async getBookingsForClubByOwner(
        clubId: string,
        currentUser: JwtPayload,
        status?: BookingStatus,
        limit: number = 0,
        skip: number = 0,
    ): Promise<Booking[]> {
        this.logger.log(`Fetching bookings for club ${clubId} by user ${currentUser.id}. Status: ${status}, Limit: ${limit}, Skip: ${skip}`);

        const clubObjectId = new Types.ObjectId(clubId);

        // 1. Fetch Club and Validate Ownership/Admin Role
        const club = await this.sportClubService.findClubById(clubId);
        if (!club) {
            throw new NotFoundException(`Club with ID ${clubId} not found.`);
        }

        const isOwner = club.owner && club.owner.toString() === currentUser.id;
        // const isAdmin = currentUser.roles.includes(Role.Admin);

        if (!isOwner) {
            this.logger.warn(`User ${currentUser.id} is not authorized to access bookings for club ${clubId}.`);
            throw new ForbiddenException('You are not authorized to access bookings for this club.');
        }

        // 2. Construct Query
        const query: any = { club: clubObjectId };
        if (status) {
            query.status = status;
        }

        // 3. Execute Query
        return this.bookingModel.find(query)
            .populate('customer', 'email name phoneNumber uid') // Populate customer with specific fields
            .populate('service', 'name') // Populate service with specific fields
            .populate('club', 'name') // Populate club with specific fields
            .sort({ bookingDate: -1, startTime: -1 }) // Sort by most recent
            .limit(limit)
            .skip(skip)
            .lean()
            .exec();
    }

    /**
     * Sets the status of bookings to 'expired' if their booking date and time have passed.
     * This is typically run as a scheduled task (cron job).
     */
    async expirePastBookings(): Promise<void> {
        const now = moment.tz(this.APP_TIMEZONE);
        this.logger.log(`Checking for bookings to expire... Current time: ${now.format()}`);

        const result = await this.bookingModel.updateMany(
            {
                status: { $in: [BookingStatus.Pending, BookingStatus.Confirmed] },
                $expr: {
                    $lte: [
                        {
                            $dateFromString: {
                                dateString: {
                                    // Convert bookingDate to string before concatenating
                                    $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$bookingDate', timezone: this.APP_TIMEZONE } }, ' ', '$endTime']
                                },
                                timezone: this.APP_TIMEZONE
                            }
                        },
                        now.toDate()
                    ]
                }
            },
            { $set: { status: BookingStatus.Expired } }
        ).exec();

        this.logger.log(`Expired ${result.modifiedCount} bookings.`);
    }
    /**
     * Sets the status of bookings to 'expired' if their booking date and time have passed.
     * This is typically run as a scheduled task (cron job).
     */
    async isExpireBooking(
        bookingId: string,
    ): Promise<boolean> {
        const now = moment.tz(this.APP_TIMEZONE);
        this.logger.log(`Checking for bookings to expire... Current time: ${now.format()}`);

        const result = await this.bookingModel.findOne(
            {
                _id: new Types.ObjectId(bookingId), // Ensure we only update the specific booking
                $expr: {
                    $lte: [
                        {
                            $dateFromString: {
                                dateString: {
                                    // Convert bookingDate to string before concatenating
                                    $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$bookingDate', timezone: this.APP_TIMEZONE } }, ' ', '$endTime']
                                },
                                timezone: this.APP_TIMEZONE
                            }
                        },
                        now.toDate()
                    ]
                }
            },
        ).exec();
        this.logger.log(`Expired ${result} bookings.`);
        return !!result
    }


}