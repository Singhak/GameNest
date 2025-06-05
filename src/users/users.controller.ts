import { Controller, Get, UseGuards, Request, Param, Body, Patch, Post, Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from '../auth/strategies/jwt.strategy'; // Use the local JwtPayload type
import { UpdateFcmTokenDto } from './dtos/update-fcm-token.dto';
import { User } from './schema/user.schema'; // Import User schema for typing

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // Apply JWT authentication and RolesGuard globally for this controller
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  private readonly logger = new Logger(UsersController.name);

  @Get()
  @Roles(Role.Admin) // Only admins can list all users
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('my-info')
  @Roles(Role.User, Role.Editor, Role.Admin, Role.Owner) // Any authenticated user can get their own info
  async getMyInfo(@Request() req) {
    this.logger.debug(`Fetching info for user: ${req.user.uid}`);
    // The user object is attached to the request by JwtAuthGuard
    const firebaseUid = req.user.uid;
    const user = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!user) {
      this.logger.error(`Authenticated user not found in DB: ${firebaseUid}`);
      // This should ideally not happen if login flow is correct
      return { message: 'User not found in local database.' };
    }
    return user;
  }

  @Get('use-info')
  async getUseDetail(@Param('id') id: string) {
    this.logger.debug(`Fetching user detail by ID: ${id}`);
    const user = await this.usersService.findById(id);
    if (!user) {
      this.logger.warn(`User not found by ID: ${id}`);
      // This should ideally not happen if login flow is correct
      return { message: 'User not found in local database.' };
    }
    return user;
  }

  @Patch('fcm-token')
  @Roles(Role.User, Role.Owner, Role.Admin) // Any authenticated user can update their FCM token
  async updateFcmToken(
    @Request() req: { user: JwtPayload },
    @Body() updateFcmTokenDto: UpdateFcmTokenDto,
  ) {
    this.logger.debug(`Updating FCM token for user ${req.user.sub}`);
    const userId = req.user.sub!;
    const updatedUser = await this.usersService.addFcmToken(userId, updateFcmTokenDto.fcmToken);
    return { message: 'FCM token updated successfully.', fcmTokens: updatedUser?.fcmTokens };
  }

  // Optional: Endpoint to remove a specific FCM token (e.g., when user logs out)
  @Post('fcm-token/remove')
  @Roles(Role.User, Role.Owner, Role.Admin)
  async removeFcmToken(
    @Request() req: { user: JwtPayload },
    @Body() updateFcmTokenDto: UpdateFcmTokenDto,
  ) {
    this.logger.debug(`Removing FCM token for user ${req.user.sub}`);
    const userId = req.user.sub!;
    const updatedUser = await this.usersService.removeFcmToken(userId, updateFcmTokenDto.fcmToken);
    return { message: 'FCM token removed successfully.', fcmTokens: updatedUser?.fcmTokens };
  }
}