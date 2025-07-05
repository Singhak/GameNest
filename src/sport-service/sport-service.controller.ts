import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, Logger, UseInterceptors, UploadedFiles, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { SportServiceService } from './sport-service.service';
import { CreateSportServiceDto } from './dtos/create-sport-dto';
import { UpdateSportServiceDto } from './dtos/update-sport-dto';
import { Types } from 'mongoose';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtPayload } from 'src/auth/strategies/jwt.strategy';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerOptions } from 'src/config/multer.config';
import 'multer';

@Controller('services')
export class SportServiceController {
    private readonly logger = new Logger(SportServiceController.name);
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

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Owner)
    @Post()
    async create(@Body() createSportServiceDto: CreateSportServiceDto) {
        const clubId = createSportServiceDto.club;
        if (Types.ObjectId.isValid(clubId)) {
            createSportServiceDto.club = new Types.ObjectId(clubId);
        }
        return this.sportService.addSport(createSportServiceDto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Owner)
    @Post('multi')
    async createMultiple(@Body() createSportServiceDto: CreateSportServiceDto[]) {
        return this.sportService.addSport(createSportServiceDto);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Owner)
    async update(@Param('id') id: string, @Body() updateSportServiceDto: UpdateSportServiceDto) {
        return this.sportService.updateSport(id, updateSportServiceDto);
    }

    @Post(':serviceId/images')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Owner)
    @UseInterceptors(FilesInterceptor('images', 10, multerOptions))
    async uploadServiceImages(
        @Request() req: { user: JwtPayload },
        @Param('serviceId') serviceId: string,
        @UploadedFiles(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB per image
                    new FileTypeValidator({ fileType: /image\/(jpeg|png|gif|webp)/ }),
                ],
                fileIsRequired: true,
            }),
        ) files: Array<Express.Multer.File>,
    ) {
        const ownerId = req.user.id;
        this.logger.log(`Owner ${ownerId} uploading ${files.length} images for service ${serviceId}.`);
        return this.sportService.uploadServiceImages(serviceId, ownerId, files);
    }
}