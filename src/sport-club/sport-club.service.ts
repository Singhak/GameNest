import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SportClub } from './sport-club.schema';
import { CreateClubDto } from './dtos/create-club.dto';
import { UsersService } from 'src/users/users.service';
import { Role } from 'src/common/enums/role.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SportClubUpdatedEvent } from './sport-club.events';
import { FirebaseService } from 'src/firebase/firebase.service';
import * as path from 'path';


@Injectable()
export class SportClubService {

    constructor(
        @InjectModel(SportClub.name) private sportClubModel: Model<SportClub>,
        private userService: UsersService,
        private eventEmitter: EventEmitter2,
        private firebaseService: FirebaseService,
    ) { }

    private readonly logger = new Logger(SportClubService.name);

    async findClubById(id: string): Promise<SportClub | null> {
        this.logger.debug(`Finding club by ID: ${id}`);
        return this.sportClubModel.findById(id).exec();
    }

    async findAllClub(): Promise<SportClub[]> {
        this.logger.debug('Finding all clubs');
        return this.sportClubModel.find().lean().exec()
    }

    async findClub(query: { [key: string]: any }): Promise<SportClub[]> {
        this.logger.debug(`Finding clubs with query: ${JSON.stringify(query)}`);
        return this.sportClubModel.find(query).lean().exec()
    }

    async getClubByOwnerId(ownerId: string): Promise<SportClub[] | undefined> {
        this.logger.debug(`Getting clubs for owner ID: ${ownerId}`);
        return this.sportClubModel.find({ owner: ownerId })
    }

    async createClub(ownerId: string, createClubDto: CreateClubDto): Promise<SportClub> {
        this.logger.log(`Attempting to create club for owner ${ownerId}`);
        // Update the user's ownedClubs array
        const user = await this.userService.findById(ownerId);
        if (!user) {
            this.logger.warn(`Owner user not found for club creation: ${ownerId}`);
            throw new NotFoundException('Owner user not found. Please register first then list your club.');
        }
        const newClub = await this.sportClubModel.create({ owner: ownerId, ...createClubDto });
        const ownedClubs = (user.ownedClubs || []).map((club: any) => typeof club === 'string' ? club : club.toString());
        ownedClubs.push(newClub.id.toString());
        const roles = user.roles || [];
        if (!roles.includes(Role.Owner)) {
            roles.push(Role.Owner);
        }
        await this.userService.updateUserById(ownerId, { ownedClubs, roles });
        this.eventEmitter.emit('club.update', new SportClubUpdatedEvent(newClub));

        return newClub;
    }

    /**
    * Updates club information for a specific club owned by the user.
    * @param clubId The ID of the club to update.
    * @param ownerId The ID of the user owning the club.
    * @param updateData The data to update the club with.
    * @returns The updated sport club document.
    * @throws NotFoundException if the club is not found or not owned by the user.
    */
    async updateClubInfo(clubId: string, ownerId: string, updateData: Partial<CreateClubDto>): Promise<SportClub | null> {
        this.logger.log(`Attempting to update club ${clubId} by owner ${ownerId}`);

        const updatedClub = await this.sportClubModel.findOneAndUpdate(
            { _id: clubId, owner: ownerId, isDeleted: false }, // Ensure club is not deleted
            { $set: updateData },
            { new: true }
        ).exec();

        if (!updatedClub) {
            this.logger.warn(`Club ${clubId} not found or not owned by ${ownerId}, or it is deleted.`);
            throw new NotFoundException(`Club not found or you don't have permission to update it.`);
        }

        this.logger.log(`Club ${clubId} updated successfully by owner ${ownerId}`);

        // Send notification about the club update
        this.eventEmitter.emit('club.update', new SportClubUpdatedEvent(updatedClub));
        return updatedClub;
    }

    async deleteOwnedClub(owerId: string, clubId: string): Promise<SportClub | null> {
        this.logger.log(`Attempting to soft delete club ${clubId} owned by ${owerId}`);
        return this.sportClubModel.findOneAndUpdate({ owner: owerId, id: clubId }, { isDeleted: true }, { new: true })
    }

    /**
     * Uploads images for a sport club to Firebase Storage and updates the club's profile.
     * @param clubId The ID of the club.
     * @param ownerId The ID of the user owning the club.
     * @param files The array of uploaded file objects from Multer.
     * @returns The updated sport club object with the new image URLs.
     */
    async uploadClubImages(clubId: string, ownerId: string, files: Array<Express.Multer.File>): Promise<SportClub> {
        const club = await this.sportClubModel.findOne({ _id: clubId, isDeleted: false });

        if (!club) {
            this.logger.error(`Club with ID ${clubId} not found for image upload.`);
            throw new NotFoundException('Club not found.');
        }

        if (club.owner.toString() !== ownerId) {
            this.logger.warn(`User ${ownerId} attempted to upload images to club ${clubId} owned by ${club.owner.toString()}.`);
            throw new ForbiddenException('You do not have permission to upload images for this club.');
        }

        const uploadPromises = files.map(file => {
            const fileExtension = path.extname(file.originalname);
            const filename = `clubs/${clubId}/${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
            this.logger.log(`Uploading new image for club ${clubId} to ${filename}`);
            return this.firebaseService.uploadFile(file.buffer, filename, file.mimetype);
        });

        const imageUrls = await Promise.all(uploadPromises);

        club.images.push(...imageUrls);
        const updatedClub = await club.save();

        this.logger.log(`Successfully added ${imageUrls.length} images to club ${clubId}.`);
        this.eventEmitter.emit('club.update', new SportClubUpdatedEvent(updatedClub));

        return updatedClub;
    }
}
