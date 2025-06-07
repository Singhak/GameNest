import { Controller, Get, Post, Put, Param, Body} from '@nestjs/common';
import { SportServiceService } from './sport-service.service';
import { CreateSportServiceDto } from './dtos/create-sport-dto';
import { UpdateSportServiceDto } from './dtos/update-sport-dto';

@Controller('services')
export class SportServiceController {
    constructor(private readonly sportService: SportServiceService) { }

    @Get()
    async getAll() {
        return this.sportService.getSportServices();
    }

    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.sportService.getSportServiceById(id);
    }

    @Get('club/:clubId')
    async getByClubId(@Param('clubId') clubId: string) {
        return this.sportService.getSportServicesByClubId(clubId);
    }

    @Post()
    async create(@Body() createSportServiceDto: CreateSportServiceDto) {
        return this.sportService.addSport(createSportServiceDto);
    }

    @Post('multi')
    async createMultiple(@Body() createSportServiceDto: CreateSportServiceDto[]) {
        return this.sportService.addSport(createSportServiceDto);
    }

    @Post(':id')
    async update(@Param('id') id: string, @Body() updateSportServiceDto: UpdateSportServiceDto) {
        return this.sportService.updateSport(id, updateSportServiceDto);
    }
}