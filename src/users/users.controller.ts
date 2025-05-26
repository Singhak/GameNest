import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // Apply JWT authentication and RolesGuard globally for this controller
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.Admin) // Only admins can list all users
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('my-info')
  @Roles(Role.User, Role.Editor, Role.Admin) // Any authenticated user can get their own info
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
}