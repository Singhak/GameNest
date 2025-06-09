import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SportService } from './sport-service.schema';
import { CreateSportServiceDto } from './dtos/create-sport-dto';
import { UpdateSportServiceDto } from './dtos/update-sport-dto';

@Injectable()
export class SportServiceService {
    // This service can be used to implement sport-related functionalities
    // such as managing sports, events, or any other sport-related logic.
    constructor(@InjectModel(SportService.name) private sportServiceModel: Model<SportService>) { }

    async getSportServices(): Promise<SportService[]> {
        return this.sportServiceModel.find().exec();
    }

    async getSportServiceById(id: string): Promise<SportService | null> {
        return this.sportServiceModel.findById(id);
    }

    async getSportServicesByClubId(clubId: string): Promise<SportService[]> {
        return this.sportServiceModel.find({ club: clubId }).lean().exec();
    }

    async addSport(sportDto: CreateSportServiceDto | CreateSportServiceDto[]): Promise<SportService> {
        return this.sportServiceModel.create(sportDto);
    }

    async updateSport(id: string, sportDto: UpdateSportServiceDto): Promise<SportService | null> {
        return this.sportServiceModel.findByIdAndUpdate(id, sportDto, { new: true });
    }

    async findById(id: string) {
        return this.sportServiceModel.findById(id).lean().exec();
    }
}
