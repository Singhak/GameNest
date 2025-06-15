import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './review.schema';
import { CreateReviewDto } from './dtos/create-review.dto';
import { UpdateReviewDto } from './dtos/update-review.dto';

@Injectable()
export class ReviewService {
    private readonly logger = new Logger(ReviewService.name);

    constructor(@InjectModel(Review.name) private reviewModel: Model<ReviewDocument>) { }

    /**
     * Creates a new review.
     * @param createReviewDto The data for the new review.
     * @returns The created review.
     */
    async create(createReviewDto: CreateReviewDto): Promise<Review> {
        this.logger.log(`Creating a new review.`);
        const createdReview = await this.reviewModel.create(createReviewDto);
        this.logger.log(`Review created successfully with ID: ${createdReview._id}`);
        return createdReview;
    }

    /**
     * Finds a review by its ID.
     * @param id The ID of the review.
     * @returns The review, or null if not found.
     */
    async findOne(id: string): Promise<Review | null> {
        try {
            const reviewId = new Types.ObjectId(id);
            this.logger.log(`Fetching review with ID: ${reviewId}`);
            const review = await this.reviewModel.findById(reviewId).exec();
            if (!review) {
                this.logger.warn(`Review with ID ${reviewId} not found.`);
                throw new NotFoundException(`Review with ID ${id} not found`);
            }
            return review;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error; // Re-throw NotFoundException to be handled by the controller
            }
            this.logger.error(`Error fetching review with ID ${id}: ${error.message}`, error.stack);
            if (error.name === 'CastError' && error.kind === 'ObjectId') {
                throw new BadRequestException('Invalid ID format provided.');
            }
            throw error;
        }
    }

    /**
     * Finds reviews by the ID of the reviewed entity (e.g., a club or service).
     * @param entityId The ID of the entity being reviewed.
     * @param entityType The type of entity being reviewed ('club' or 'service').
     * @returns An array of reviews for the entity.
     */
    async findByEntity(entityId: string, entityType: 'club' | 'service'): Promise<Review[]> {
        try {
            const entityObjectId = new Types.ObjectId(entityId);
            this.logger.log(`Fetching reviews for ${entityType} with ID: ${entityObjectId}`);
            const reviews = await this.reviewModel.find({ entityId: entityObjectId, entityType }).exec();
            return reviews;
        } catch (error) {
            this.logger.error(`Error fetching reviews for ${entityType} with ID ${entityId}: ${error.message}`, error.stack);
            if (error.name === 'CastError' && error.kind === 'ObjectId') {
                throw new BadRequestException('Invalid entity ID format provided.');
            }
            throw error;
        }
    }

    /**
     * Updates a review.
     * @param id The ID of the review to update.
     * @param updateReviewDto The update data.
     * @returns The updated review, or null if not found.
     */
    async update(id: string, updateReviewDto: UpdateReviewDto): Promise<Review | null> {
        try {
            const reviewId = new Types.ObjectId(id);
            this.logger.log(`Updating review with ID: ${reviewId}`);
            const updatedReview = await this.reviewModel.findByIdAndUpdate(reviewId, updateReviewDto, { new: true }).exec();
            if (!updatedReview) {
                this.logger.warn(`Review with ID ${reviewId} not found for update.`);
                throw new NotFoundException(`Review with ID ${id} not found`);
            }
            this.logger.log(`Review ${reviewId} updated successfully.`);
            return updatedReview;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error; // Re-throw NotFoundException
            }
            this.logger.error(`Error updating review with ID ${id}: ${error.message}`, error.stack);
            if (error.name === 'CastError' && error.kind === 'ObjectId') {
                throw new BadRequestException('Invalid ID format provided.');
            }
            throw error;
        }
    }

    /**
     * Removes a review.
     * @param id The ID of the review to remove.
     * @returns True if the review was successfully removed, false otherwise.
     */
    async remove(id: string): Promise<boolean> {
        try {
            const reviewId = new Types.ObjectId(id);
            this.logger.log(`Removing review with ID: ${reviewId}`);
            const result = await this.reviewModel.findByIdAndDelete(reviewId).exec();
            return !!result; // Returns true if deletion was successful
        } catch (error) {
            this.logger.error(`Error removing review with ID ${id}: ${error.message}`, error.stack);
            return false;
        }
    }
}
