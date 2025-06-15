// src/booking/booking.controller.ts
import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus, Logger, Param, BadRequestException, Get } from '@nestjs/common';
import { BookingService } from './booking.service'; // Corrected import path
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateBookingDto } from './dtos/create-booking.dto';
import { UpdateBookingDto } from './dtos/update-booking.dto';
import { Types } from 'mongoose'; // Keep Types import
import { Booking } from './booking.schema';

@Controller('bookings')
@Roles(Role.User) // Only regular users (customers) can create bookings
export class BookingController {
  private readonly logger = new Logger(BookingController.name);
  constructor(private readonly bookingService: BookingService) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: { user: JwtPayload }, // req.user will contain the customer's JWT payload
    @Body() createBookingDto: CreateBookingDto,
  ) {
    // The customerId comes from the authenticated user's token
    this.logger.log(`Received create booking request from user ${req.user.id}`);
    const customerId = req.user.id; // Assuming 'sub' is the local MongoDB User ID
    const booking = await this.bookingService.createBooking(customerId, createBookingDto);
    return {
      message: 'Booking request submitted successfully. Awaiting club owner confirmation.',
      bookingId: booking.id,
      status: booking.status,
    };
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  async updateBooking(
    @Param('id') bookingId: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Req() req: { user: JwtPayload }, // To get the current user
  ) {
    this.logger.log(`Received update booking request for ID ${bookingId} from user ${req.user.id}`);
    // const currentUser = req.user.sub;  // Cast to User type (ensure this matches your JWT payload structure)
    return this.bookingService.updateBooking(bookingId, updateBookingDto, req.user);
  }

  /**
     * Retrieves the status of a specific booking.
     * @param bookingId The ID of the booking.
     * @returns An object containing the booking status.
     */
  @Get(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getBookingStatus(@Param('id') bookingId: string): Promise<{ status: String }> {
    this.logger.log(`Fetching status for booking ${bookingId}`);
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException('Invalid booking ID format.');
    }
    const status = await this.bookingService.getBookingStatus(bookingId);
    return { status };
  }

  /**
   * Retrieves bookings for a specific service on a given date.
   * Accessible by Admins or Owners of the club.
   * @param serviceId The ID of the sport service.
   * @param dateString The date in 'YYYY-MM-DD' format.
   * @returns A list of bookings.
   */
  @Get('service/:serviceId/date/:dateString')
  async getBookingsForServiceOnDate(
    @Param('serviceId') serviceId: string,
    @Param('dateString') dateString: string,
  ): Promise<Booking[]> {
    this.logger.log(`User requesting bookings for service ${serviceId} on ${dateString}`);
    if (!Types.ObjectId.isValid(serviceId)) {
      throw new BadRequestException('Invalid service ID format.');
    }
    // Date format validation (e.g., YYYY-MM-DD) is handled in the service or can be added via a pipe.
    return this.bookingService.getBookingsByServiceAndDate(serviceId, dateString);
  }
}