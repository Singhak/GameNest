import { Controller, Get, UseGuards, Request, Param, Body, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from 'jsonwebtoken';
import { UpdateFcmTokenDto } from './dtos/update-fcm-token.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // Apply JWT authentication and RolesGuard globally for this controller
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @Roles(Role.Admin) // Only admins can list all users
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('my-info')
  @Roles(Role.User, Role.Editor, Role.Admin, Role.Owner) // Any authenticated user can get their own info
  async getMyInfo(@Request() req) {
    // The user object is attached to the request by JwtAuthGuard
    const firebaseUid = req.user.uid;
    const user = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!user) {
      // This should ideally not happen if login flow is correct
      return { message: 'User not found in local database.' };
    }
    return user;
  }

  @Get('use-info')
  async getUseDetail(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
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
    const userId = req.user.sub!;
    const updatedUser = await this.usersService.removeFcmToken(userId, updateFcmTokenDto.fcmToken);
    return { message: 'FCM token removed successfully.', fcmTokens: updatedUser?.fcmTokens };
  }
}