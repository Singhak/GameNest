import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested, IsPhoneNumber, IsBoolean, IsArray } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

class AddressDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    street?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    city?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    state?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    zipCode?: string;
}
export class UpdateUserDto extends PartialType(CreateUserDto){
   @IsOptional()
   @IsArray()
   fcmTokens?: string[];
}