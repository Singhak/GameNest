import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BookingStatus } from 'src/common/enums/booking-status.enum';

export class UpdateBookingDto {
    @IsOptional()
    @IsEnum(BookingStatus)
    status?: BookingStatus;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}