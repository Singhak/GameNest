import { IsNumber, Min, Max, IsOptional } from 'class-validator';

export class UpdateReviewDto {
    @IsOptional()
    // We may allow updating the comment in the future
    // @IsString()
    // comment?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(5)
    rating?: number;

    // We may add fields like 'isHelpful' for users to vote on reviews
    // @IsOptional()
    // @IsBoolean()
    // isHelpful?: boolean;
}