import { Controller, Get, Param, Query, Post, Body, Delete, Request, BadRequestException, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { SportClubService } from './sport-club.service';
import { CreateClubDto } from './dtos/create-club.dto';
import { JwtPayload } from 'jsonwebtoken';

@Controller('clubs')
export class SportClubController {
    private readonly logger = new Logger(SportClubController.name);

    constructor(private readonly sportClubService: SportClubService) { }

    @Get()
    async findAll() {
        return this.sportClubService.findAllClub();
    }

    @Get('search')
    async find(@Query() query: { [key: string]: any }) {
        this.logger.debug(`Received search query for clubs: ${JSON.stringify(query)}`);
        return this.sportClubService.findClub(query);
    }

    @Get()
    async getByOwner(@Request() req: { user: JwtPayload }) {
        const ownerId = req.user.sub;
        if (!ownerId) {
            this.logger.warn('Attempted to get clubs by owner without owner ID in JWT.');
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.getClubByOwnerId(ownerId);
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        this.logger.debug(`Received request to find club by ID: ${id}`);
        return this.sportClubService.findClubById(id);
    }

    @Get()
    async getOwnedClubs(@Request() req: { user: JwtPayload }) {
        const ownerId = req.user.sub;
        if (!ownerId) {
            this.logger.warn('Attempted to get owned clubs without owner ID in JWT.');
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.getClubByOwnerId(ownerId);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Request() req: { user: JwtPayload }, @Body() createClubDto: CreateClubDto) {
        const ownerId = req.user.sub;
        if (!ownerId) {
            this.logger.warn('Attempted to create club without owner ID in JWT.');
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.createClub(ownerId, createClubDto);
    }

    @Delete(':clubId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteOwnedClub(@Request() req: { user: JwtPayload }, @Param('clubId') clubId: string) {
        const ownerId = req.user.sub;
        if (!ownerId) {
            this.logger.warn('Attempted to delete owned club without owner ID in JWT.');
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.deleteOwnedClub(ownerId, clubId);
    }
}