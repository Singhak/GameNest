import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus, NotFoundException, Logger, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto'; // Corrected import path
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AssignRolesDto } from './dtos/assign-roles.dto'; // DTO for assigning roles
import { Role } from '../common/enums/role.enum';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) { }

  /**
   * Endpoint for user login.
   * Expects a Firebase ID token in the request body.
   * Returns a custom JWT access token.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK) // Return 200 OK for successful login
  async login(@Body() loginDto: LoginDto): Promise<{ accessToken: string }> {
    this.logger.log('Received login request');
    return this.authService.login(loginDto);
  }

  /**
   * Protected endpoint accessible by any authenticated user.
   * Demonstrates how to access user information from the JWT payload.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req) {
    this.logger.debug(`Received 'me' request for user: ${req.user.uid}`);
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
  @HttpCode(HttpStatus.OK) // Consider HttpStatus.NO_CONTENT (204) if no body is needed
  async assignRoles(@Body() assignRolesDto: AssignRolesDto) {
    const { firebaseUid, roles } = assignRolesDto;
    this.logger.log(`Received request to assign roles ${roles.join(', ')} to Firebase UID: ${firebaseUid}`);
    const updatedUser = await this.authService.assignRoles(firebaseUid, roles);
    if (!updatedUser) {
      this.logger.warn(`User with Firebase UID ${firebaseUid} not found during role assignment.`);
      throw new NotFoundException('User does not exist'); // Corrected typo
    }
    return {
      message: `Roles updated for user ${firebaseUid}`,
      user: {
        firebaseUid: updatedUser.uid,
        email: updatedUser.email,
        roles: updatedUser.roles,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh-access-token')
  async refreshAccessToken(@Req() req, @Body() body: { refreshToken: string }) {
    // 1. Extract user ID and refreshtoken
    const { refreshToken } = body;
    const userId = req.user.id;
    return this.authService.refreshAccessToken(userId, refreshToken);
  }
}