import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateSportServiceDto } from "./create-sport-dto";

export class UpdateSportServiceDto extends PartialType(CreateSportServiceDto) {
    @IsBoolean()
    @IsOptional()
    isActive?: boolean; // Optional field to indicate if the sport service is active or not
    @IsBoolean()
    @IsOptional()
    isDeleted?: boolean; // Optional field to indicate if the sport service is deleted or not
}