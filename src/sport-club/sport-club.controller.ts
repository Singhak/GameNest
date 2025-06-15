import { Controller, Get, Param, Query, Post, Body, Delete, Request, BadRequestException, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { SportClubService } from './sport-club.service';
import { CreateClubDto } from './dtos/create-club.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtPayload } // Assuming JwtPayload is defined in your auth module, e.g., from 'src/auth/strategies/jwt.strategy'
    from 'src/auth/strategies/jwt.strategy'; // Or wherever your JwtPayload is defined

@Controller('clubs')
export class SportClubController {
    private readonly logger = new Logger(SportClubController.name);

    constructor(private readonly sportClubService: SportClubService) { }

    @Get()
    @Roles(Role.User, Role.Admin, Role.Editor, Role.Owner) // Any authenticated user can view all clubs
    async findAll() {
        return this.sportClubService.findAllClub();
    }

    @Get('search')
    @Roles(Role.User, Role.Admin, Role.Editor, Role.Owner) // Any authenticated user can search clubs
    async find(@Query() query: { [key: string]: any }) {
        this.logger.debug(`Received search query for clubs: ${JSON.stringify(query)}`);
        return this.sportClubService.findClub(query);
    }

    // Renamed and specified path to avoid conflict
    @Get('my-owned')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Owner) // Only users with Owner role can get their owned clubs
    async getMyOwnedClubs(@Request() req: { user: JwtPayload }) {
        const ownerId = req.user.id; // Assuming 'id' is the MongoDB user ID from JWT
        if (!ownerId) {
            this.logger.warn('Attempted to get clubs by owner without owner ID in JWT.');
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.getClubByOwnerId(ownerId);
    }

    @Get(':id')
    @Roles(Role.User, Role.Admin, Role.Editor, Role.Owner) // Any authenticated user can view a specific club
    async findById(@Param('id') id: string) {
        this.logger.debug(`Received request to find club by ID: ${id}`);
        return this.sportClubService.findClubById(id);
    }

    @Get('owner/:ownerId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.User, Role.Admin, Role.Editor, Role.Owner) // Any authenticated user can view a specific club
    async findByOwnerId(@Param('ownerId') id: string) {
        this.logger.debug(`Received request to find club by Owner ID: ${id}`);
        return this.sportClubService.getClubByOwnerId(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)    
    @HttpCode(HttpStatus.CREATED)
    @Roles(Role.User, Role.Admin, Role.Owner) // Users, Admins, or existing Owners can create clubs
    async create(@Request() req: { user: JwtPayload }, @Body() createClubDto: CreateClubDto) {
        const ownerId = req.user.id; // Assuming 'id' is the MongoDB user ID from JWT
        if (!ownerId) {
            this.logger.warn('Attempted to create club without owner ID in JWT.');
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.createClub(ownerId, createClubDto);
    }

    @Delete(':clubId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(Role.Owner, Role.Admin) // Only Owners (of that specific club) or Admins can delete
    async deleteOwnedClub(@Request() req: { user: JwtPayload }, @Param('clubId') clubId: string) {
        const ownerId = req.user.id; // Assuming 'id' is the MongoDB user ID from JWT
        if (!ownerId) {
            this.logger.warn('Attempted to delete owned club without owner ID in JWT.');
            throw new BadRequestException('Owner ID is required');
        }
        return this.sportClubService.deleteOwnedClub(ownerId, clubId);
    }
}