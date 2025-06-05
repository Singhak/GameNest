// src/booking/booking.controller.ts
import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus, Logger, Param } from '@nestjs/common';
import { BookingService } from './booking.service'; // Corrected import path
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateBookingDto } from './dtos/create-booking.dto';
import { UpdateBookingDto } from './dtos/update-booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.User) // Only regular users (customers) can create bookings
export class BookingController {
  private readonly logger = new Logger(BookingController.name);
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: { user: JwtPayload }, // req.user will contain the customer's JWT payload
    @Body() createBookingDto: CreateBookingDto,
  ) {
    // The customerId comes from the authenticated user's token
    this.logger.log(`Received create booking request from user ${req.user.sub}`);
    const customerId = req.user.sub; // Assuming 'sub' is the local MongoDB User ID
    const booking = await this.bookingService.createBooking(customerId, createBookingDto);
    return {
      message: 'Booking request submitted successfully. Awaiting club owner confirmation.',
      bookingId: booking.id,
      status: booking.status,
    };
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard) // Ensure user is authenticated
  @HttpCode(HttpStatus.OK)
  async updateBooking(
    @Param('id') bookingId: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Req() req: { user: JwtPayload }, // To get the current user
  ) {
    this.logger.log(`Received update booking request for ID ${bookingId} from user ${req.user.sub}`);
    // const currentUser = req.user.sub;  // Cast to User type (ensure this matches your JWT payload structure)
    return this.bookingService.updateBooking(bookingId, updateBookingDto, req.user);
  }
}