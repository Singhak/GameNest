import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService }  from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AssignRolesDto } from './dtos/assign-roles.dto'; // DTO for assigning roles
import { Role } from '../common/enums/role.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint for user login.
   * Expects a Firebase ID token in the request body.
   * Returns a custom JWT access token.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK) // Return 200 OK for successful login
  async login(@Body() loginDto: LoginDto): Promise<{ accessToken: string }> {
    return this.authService.login(loginDto);
  }

  /**
   * Protected endpoint accessible by any authenticated user.
   * Demonstrates how to access user information from the JWT payload.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req) {
    // req.user contains the decoded JWT payload (uid, email, roles, sub)
    return {
      message: `Hello ${req.user.email}! You are authenticated.`,
      user: req.user,
    };
  }

  /**
   * Admin-only endpoint to assign roles to other users.
   * Requires JWT authentication and 'admin' role.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('assign-roles')
  @HttpCode(HttpStatus.OK)
  async assignRoles(@Body() assignRolesDto: AssignRolesDto) {
    const { firebaseUid, roles } = assignRolesDto;
    const updatedUser = await this.authService.assignRoles(firebaseUid, roles);
    return {
      message: `Roles updated for user ${firebaseUid}`,
      user: {
        firebaseUid: updatedUser.uid,
        email: updatedUser.email,
        roles: updatedUser.roles,
      },
    };
  }
}