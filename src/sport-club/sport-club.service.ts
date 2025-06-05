import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SportClub } from './sport-club.schema';
import { CreateClubDto } from './dtos/create-club.dto';
import { UsersService } from 'src/users/users.service';


@Injectable()
export class SportClubService {

    constructor(@InjectModel(SportClub.name) private sportClubModel: Model<SportClub>, private userService: UsersService) { }

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
            throw new NotFoundException('Please Register first then List your club')
        }
        const newClub = await this.sportClubModel.create({ owner: ownerId, ...createClubDto })
        const ownedClubs = user.ownedClubs;
        ownedClubs.push(newClub.id);
        await this.userService.updateUserById(ownerId, { ownedClubs })
        return newClub;
    }

    async deleteOwnedClub(owerId: string, clubId: string): Promise<SportClub | null> {
        this.logger.log(`Attempting to soft delete club ${clubId} owned by ${owerId}`);
        return this.sportClubModel.findOneAndUpdate({ owner: owerId, id: clubId }, { isDeleted: true }, { new: true })
    }
}
