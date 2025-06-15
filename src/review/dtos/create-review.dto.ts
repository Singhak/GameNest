import { IsNotEmpty, IsString, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { Types } from 'mongoose';

export enum EntityType {
    Club = 'club',
    Service = 'service',
}

export class CreateReviewDto {
    @IsNotEmpty()
    entityId: Types.ObjectId;

    @IsEnum(EntityType)
    entityType: EntityType;

    @IsNotEmpty()
    @IsString()
    userId: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    @Max(5)
    rating: number;
}