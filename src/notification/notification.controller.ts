// src/notification/notification.controller.ts
import { Controller, Get, Query, Body, UseGuards, Req, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MarkNotificationsReadDto } from './dtos/mark-notifications-read.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard) // Protect all routes in this controller
@Roles(Role.User, Role.Owner, Role.Admin) // Users, Owners, and Admins can access their notifications
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Get()
    @HttpCode(HttpStatus.OK)
    async getMyNotifications(
        @Req() req: { user: JwtPayload },
        @Query('isRead') isRead?: string, // Query parameter to filter by read status
        @Query('limit') limit: string = '20',
        @Query('skip') skip: string = '0',
    ) {
        const userId = req.user.sub;
        // Convert 'true'/'false' string from query param to boolean
        const isReadBoolean = isRead !== undefined ? (isRead === 'true') : undefined;

        return this.notificationService.getNotificationsForUser(
            userId,
            isReadBoolean,
            parseInt(limit, 10),
            parseInt(skip, 10),
        );
    }

    @Post('mark-read')
    @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content for successful update without returning data
    async markSelectedNotificationsAsRead(
        @Req() req: { user: JwtPayload },
        @Body() markDto: MarkNotificationsReadDto, // Use the DTO for validation
    ) {
        const userId = req.user.sub;
        await this.notificationService.markNotificationsAsRead(markDto.notificationIds, userId);
        return; // Return nothing, as per 204 No Content
    }

    @Post('mark-all-read')
    @HttpCode(HttpStatus.NO_CONTENT)
    async markAllMyNotificationsAsRead(@Req() req: { user: JwtPayload }) {
        const userId = req.user.sub;
        await this.notificationService.markAllUserNotificationsAsRead(userId);
        return;
    }
}