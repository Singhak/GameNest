// src/booking/booking.controller.ts
import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateBookingDto } from './dtos/create-booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.User) // Only regular users (customers) can create bookings
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: { user: JwtPayload }, // req.user will contain the customer's JWT payload
    @Body() createBookingDto: CreateBookingDto,
  ) {
    // The customerId comes from the authenticated user's token
    const customerId = req.user.sub; // Assuming 'sub' is the local MongoDB User ID
    const booking = await this.bookingService.createBooking(customerId, createBookingDto);
    return {
      message: 'Booking request submitted successfully. Awaiting club owner confirmation.',
      bookingId: booking.id,
      status: booking.status,
    };
  }
}