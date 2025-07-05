import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SportService, SportServiceDocument } from './sport-service.schema';
import { CreateSportServiceDto } from './dtos/create-sport-dto';
import { UpdateSportServiceDto } from './dtos/update-sport-dto';
import { FirebaseService } from 'src/firebase/firebase.service';
import { SportClubService } from 'src/sport-club/sport-club.service';
import * as path from 'path';
import { SportClub } from 'src/sport-club/sport-club.schema';

@Injectable()
export class SportServiceService {
    private readonly logger = new Logger(SportServiceService.name);

    constructor(
        @InjectModel(SportService.name) private sportServiceModel: Model<SportServiceDocument>,
        private readonly firebaseService: FirebaseService,
        private readonly sportClubService: SportClubService, // Injected for potential future use in complex club logic
    ) { }

    async getSportServices(): Promise<SportService[]> {
        return this.sportServiceModel.find().exec();
    }

    async getSportServiceById(id: string): Promise<SportService | null> {
        return this.sportServiceModel.findById(id);
    }

    async getSportServicesByClubId(clubId: string): Promise<SportService[]> {
        return this.sportServiceModel.find({ club: clubId }).lean().exec();
    }

    async addSport(sportDto: CreateSportServiceDto | CreateSportServiceDto[]): Promise<any> {
        return this.sportServiceModel.create(sportDto);
    }

    async updateSport(id: string, sportDto: UpdateSportServiceDto): Promise<SportService | null> {
        return this.sportServiceModel.findByIdAndUpdate(id, sportDto, { new: true });
    }

    async findById(id: string) {
        return this.sportServiceModel.findById(id).lean().exec();
    }

    /**
     * Uploads images for a sport service to Firebase Storage and updates its document.
     * @param serviceId The ID of the sport service.
     * @param ownerId The ID of the user claiming ownership.
     * @param files The array of uploaded file objects from Multer.
     * @returns The updated sport service object with the new image URLs.
     */
    async uploadServiceImages(serviceId: string, ownerId: string, files: Array<Express.Multer.File>): Promise<SportService> {
        const service = await this.sportServiceModel.findById(serviceId).populate('club');

        if (!service) {
            this.logger.error(`Service with ID ${serviceId} not found for image upload.`);
            throw new NotFoundException('Sport service not found.');
        }

        // The club is populated, so we can access its owner.
        const club = service.club as SportClub; // Cast to access owner property
        if (!club || club.owner.toString() !== ownerId) {
            this.logger.warn(`User ${ownerId} attempted to upload images to service ${serviceId} which they do not own.`);
            throw new ForbiddenException('You do not have permission to upload images for this service.');
        }

        const uploadPromises = files.map(file => {
            const fileExtension = path.extname(file.originalname);
            // Unique filename to prevent overwrites
            const filename = `services/${serviceId}/${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
            this.logger.log(`Uploading new image for service ${serviceId} to ${filename}`);
            return this.firebaseService.uploadFile(file.buffer, filename, file.mimetype);
        });

        const imageUrls = await Promise.all(uploadPromises);

        // Add new image URLs to the existing array
        service.images.push(...imageUrls);
        const updatedService = await service.save();

        this.logger.log(`Successfully added ${imageUrls.length} images to service ${serviceId}.`);
        return updatedService;
    }
}
