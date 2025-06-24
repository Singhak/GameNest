import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SportClub } from './sport-club.schema';
import { CreateClubDto } from './dtos/create-club.dto';
import { UsersService } from 'src/users/users.service';
import { Role } from 'src/common/enums/role.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SportClubUpdatedEvent } from './sport-club.events';


@Injectable()
export class SportClubService {

    constructor(@InjectModel(SportClub.name) private sportClubModel: Model<SportClub>, private userService: UsersService, private eventEmitter: EventEmitter2,) { }

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
}
