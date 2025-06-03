// src/booking/booking.service.ts

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from './booking.schema';
import { SportService, SportServiceDocument } from 'src/sport-service/sport-service.schema';
import * as moment from 'moment-timezone';
import { NotificationService } from 'src/notification/notification.service';
import { UsersService } from 'src/users/users.service';
import { CreateBookingDto } from './dtos/create-booking.dto';
import { NotificationType } from 'src/common/enums/notification-enum';

@Injectable()
export class BookingService {
    private readonly APP_TIMEZONE = 'Asia/Kolkata'; // Or load from config

    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
        @InjectModel(SportService.name) private sportServiceMode: Model<SportServiceDocument>,
        private readonly notificationService: NotificationService, // Inject NotificationService
        private readonly usersService: UsersService, // Inject UsersService
    ) { }

    async getAvailableSlots(serviceId: string, dateString: string, timezone: string = 'Asia/Kolkata'): Promise<string[]> {
        const service = await this.sportServiceMode.findById(serviceId).exec();
        if (!service) {
            throw new NotFoundException('Sport service not found.');
        }

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

        // 1. Fetch SportService and Club Details
        const service = await this.sportServiceMode.findById(serviceId).populate('club').exec();
        if (!service || !service.isActive) {
            throw new NotFoundException('Sport service not found or is inactive.');
        }
        if (!service.club) {
            throw new NotFoundException('Sport service is not associated with a club.');
        }

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
            throw new BadRequestException('Invalid start or end time for booking.');
        }

        // Ensure booking is in the future
        if (slotStartMoment.isSameOrBefore(moment.tz(this.APP_TIMEZONE))) {
            throw new BadRequestException('Bookings can only be made for future slots.');
        }

        // Validate against service's operating hours and days
        if (!service.availableDays.includes(dayOfWeek) ||
            slotStartMoment.isBefore(serviceOpeningMoment) ||
            slotEndMoment.isAfter(serviceClosingMoment) ||
            slotStartMoment.isBefore(serviceOpeningMoment) || // Redundant, but good for clarity
            slotEndMoment.isAfter(serviceClosingMoment)
        ) {
            throw new BadRequestException(`Service is not available during the requested time (${dayOfWeek} ${startTime}-${endTime}).`);
        }

        // Validate slot duration matches service's defined slot duration
        const requestedDurationMinutes = slotEndMoment.diff(slotStartMoment, 'minutes');
        if (requestedDurationMinutes % service.slotDurationMinutes !== 0 || requestedDurationMinutes === 0) {
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
            status: 'pending', // Default status upon creation
            paymentStatus: 'pending', // Assume payment is pending at creation
            notes: notes,
        });

        const createdBooking = await newBooking.save();

        // 6. Trigger Notification to Club Owner
        // Fetch club owner's Firebase UID for push notification
        const clubOwner = await this.usersService.findById(club.id.toString());
        if (clubOwner && clubOwner.uid) {
            await this.notificationService.sendPushNotification(
                clubOwner.uid,
                'New Booking Request!',
                `A new booking for ${service.name} on ${bookingDate} from ${startTime} to ${endTime} needs your review.`,
                { bookingId: createdBooking.id.toString(), type: 'new_booking' }
            );

            // Also create an in-app notification
            await this.notificationService.createNotification(
                clubOwner.id,
                'New Booking Request!',
                `New booking for ${service.name} (${bookingMomentDate.format('MMM D')}, ${startTime}-${endTime}).`,
                NotificationType.BookingPending,
                createdBooking.id
            );
        }

        return createdBooking;
    }
}