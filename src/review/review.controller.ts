import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe, ParseEnumPipe, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto, EntityType } from './dtos/create-review.dto';
import { UpdateReviewDto } from './dtos/update-review.dto';
import { Types } from 'mongoose';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Role } from 'src/common/enums/role.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from 'jsonwebtoken';

@Controller('reviews')
export class ReviewController {
    constructor(private readonly reviewService: ReviewService) { }

    /**
     * Creates a new review. Requires user authentication.
     * @param createReviewDto The DTO containing review creation data.
     * @param req The request object containing user information.
     * @returns The created review.
     */
    @UseGuards(JwtAuthGuard)
    @Post()
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async create(@Body() createReviewDto: CreateReviewDto, @Req() req: { user: JwtPayload },) {
        // Ensure the user ID from the JWT matches the review's userId (or handle as needed)
        const userIdFromToken = req.user.id; // Assuming 'sub' claim holds the user ID
        if (userIdFromToken !== createReviewDto.userId) {
            throw new BadRequestException('User ID in token does not match the review\'s user ID.');
        }
        createReviewDto.entityId = new Types.ObjectId(createReviewDto.entityId);
        return this.reviewService.create(createReviewDto);
    }

    /**
     * Retrieves a review by its ID.
     * @param id The ID of the review.
     * @returns The review if found.
     */
    @Get(':id')
    async findOne(@Param('id') id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid ID format');
        }
        return this.reviewService.findOne(id);
    }

    /**
     * Retrieves reviews for a specific entity (club or service).
     * @param entityType The type of entity being reviewed ('club' or 'service').
     * @param entityId The ID of the entity.
     * @returns An array of reviews for the entity.
     */
    @Get(':entityType/:entityId')
    async findByEntity(
        @Param('entityType', new ParseEnumPipe(EntityType)) entityType: EntityType,
        @Param('entityId') entityId: string,
    ) {
        if (!Types.ObjectId.isValid(entityId)) {
            throw new BadRequestException('Invalid entity ID format');
        }
        return this.reviewService.findByEntity(entityId, entityType);
    }

    /**
     * Updates a review.  Requires user authentication and the 'Admin' role.
     *  Consider also allowing the review author to update (implementation not shown).
     * @param id The ID of the review to update.
     * @param updateReviewDto The DTO containing update data.
     * @returns The updated review if successful.
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin) // Adjust roles as needed, e.g., allow 'Owner' or the review's User
    @Patch(':id')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid ID format');
        }
        return this.reviewService.update(id, updateReviewDto);
    }

    /**
     * Deletes a review. Requires user authentication and the 'Admin' role.
     * @param id The ID of the review to delete.
     * @returns True if deletion was successful.
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin) // Adjust roles to control who can delete reviews
    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.reviewService.remove(id);
    }
}
