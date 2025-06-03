import { Controller, Get, Param, Query, Post, Body, Delete, Request, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { SportClubService } from './sport-club.service';
import { CreateClubDto } from './dtos/create-club.dto';
import { JwtPayload } from 'jsonwebtoken';

@Controller('club')
export class SportClubController {
    constructor(private readonly sportClubService: SportClubService) { }

    @Get()
    async findAll() {
        return this.sportClubService.findAllClub();
    }

    @Get('search')
    async find(@Query() query: { [key: string]: any }) {
        return this.sportClubService.findClub(query);
    }

    @Get()
    async getByOwner(@Request() req: { user: JwtPayload }) {
        const ownerId = req.user.sub;
        if (!ownerId) {
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.getClubByOwnerId(ownerId);
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.sportClubService.findClubById(id);
    }

    @Get()
    async getOwnedClubs(@Request() req: { user: JwtPayload }) {
        const ownerId = req.user.sub;
        if (!ownerId) {
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.getClubByOwnerId(ownerId);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Request() req: { user: JwtPayload }, @Body() createClubDto: CreateClubDto) {
        const ownerId = req.user.sub;
        if (!ownerId) {
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.createClub(ownerId, createClubDto);
    }

    @Delete(':clubId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteOwnedClub(@Request() req: { user: JwtPayload }, @Param('clubId') clubId: string) {
        const ownerId = req.user.sub;
        if (!ownerId) {
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.deleteOwnedClub(ownerId, clubId);
    }
}