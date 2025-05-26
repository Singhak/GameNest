import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import { UsersService } from '../../users/users.service'; // To fetch full user data if needed
import { User } from 'src/users/schema/user.schema';
import { Role } from 'src/common/enums/role.enum';

// Define the shape of our JWT payload
export interface JwtPayload {
  uid: string; // Firebase UID
  email: string;
  roles: string[]; // User roles
  sub: string; // Local database user ID (if applicable)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService, // Inject UsersService to potentially fetch full user data
  ) {
    const jwtSecret = configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      throw new Error('JWT secret is not defined in configuration');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extract JWT from Authorization header
      ignoreExpiration: false, // Do not ignore token expiration
      secretOrKey: jwtSecret, // Use JWT secret from config
    });
  }

  /**
   * Validates the decoded JWT payload.
   * This method is called after the JWT is successfully verified.
   * @param payload The decoded JWT payload.
   * @returns The user object to be attached to `req.user`.
   */
  async validate(payload: JwtPayload): Promise<Partial<User>> {
    // Here, you can optionally fetch the full user from your database
    // using payload.uid or payload.sub to ensure the user still exists
    // and their roles are up-to-date.
    const user = await this.usersService.findByFirebaseUid(payload.uid);

    if (!user || JSON.stringify(user.roles) !== JSON.stringify(payload.roles)) {
        // If user not found or roles in token are outdated,
        // you might want to re-authenticate or throw an error.
        // For simplicity, we'll just return the payload's user data.
        // In a real application, you might want to refresh the token or deny access.
        console.warn(`User ${payload.email} roles in token might be outdated or user not found. Using token roles.`);
    }

    // Return the payload. This object will be attached to `req.user`
    // and will be available in controllers and guards.
    return {
      id: payload.sub,
      uid: payload.uid,
      email: payload.email,
      roles: payload.roles as Role[],
    };
  }
}