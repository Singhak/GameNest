import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { FirebaseService } from '../firebase/firebase.service';
import { LoginDto } from './dtos/login.dto';
import { Role } from 'src/common/enums/role.enum';
import { User } from 'src/users/schema/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private firebaseService: FirebaseService,
    private configService: ConfigService,
  ) { }

  /**
   * Handles user login by verifying Firebase ID token and issuing a custom JWT.
   * Also ensures user exists in the local database and has roles assigned.
   * @param idToken The Firebase ID token received from the client.
   * @returns An object containing the custom JWT access token.
   */
  async login(loginDto: LoginDto): Promise<{ accessToken: string, refreshToken: string }> {
    const { idToken } = loginDto;

    if (!idToken) {
      throw new BadRequestException('Firebase ID token is required.');
    }

    try {
      // 1. Verify the Firebase ID token using Firebase Admin SDK
      const decodedToken = await this.firebaseService.verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email; // Email is often present in the token

      // 2. Check/create user in our local database
      // This is where you would interact with your actual database (e.g., MongoDB, PostgreSQL)
      let user = await this.usersService.findByFirebaseUid(firebaseUid);

      if (!user) {
        // If user doesn't exist, create a new entry with a default role
        user = await this.usersService.createUser({
          uid: firebaseUid,
          email: email,
          roles: [Role.User], // Assign a default 'user' role
        });
        console.log(`New user created in local DB: ${user.email} with UID: ${user.uid}`);
      } else {
        // Optionally, update user details if they changed in Firebase
        if (user.email !== email) {
          await this.usersService.updateUserById(user.id, { email: email });
        }
        console.log(`Existing user logged in: ${user.email} with UID: ${user.uid}`);
      }

      // 3. Generate a custom JWT containing essential user info and roles
      // This JWT will be used for subsequent requests to our NestJS backend
      const payload = {
        uid: user.uid,
        email: user.email,
        roles: user.roles, // Roles from your local database
        sub: user.id, // Subject of the token, typically the primary key in your database
      };

      const accessToken = this.jwtService.sign(payload);

      const refreshToken = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      });

      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      const refreshTokenExpiresAt = new Date(Date.now() + parseInt(this.configService.get('jwt.refreshExpiresIn')?.replace('d', '')) * 24 * 60 * 60 * 1000); // Convert '7d' to milliseconds
      const issuedAt = new Date();

      // Store the new refresh token hash in the array
      await this.usersService.addRefreshToken(user.id, {
        tokenHash: hashedRefreshToken,
        expiresAt: refreshTokenExpiresAt,
        issuedAt: issuedAt,
        // deviceId: deviceId // Include deviceId if sent from client
      });

      return { accessToken, refreshToken };
    } catch (error) {
      console.error('Login failed:', error.message);
      // Re-throw specific exceptions or a generic UnauthorizedException
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed. Invalid token or user data.');
    }
  }

  /**
   * Sets custom roles for a user in the local database and potentially in Firebase custom claims.
   * This method would typically be called by an admin user.
   * @param firebaseUid The Firebase UID of the user to update.
   * @param roles The array of roles to assign.
   * @returns The updated user object.
   */
  async assignRoles(firebaseUid: string, roles: Role[]): Promise<User | null> {
    const user = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new BadRequestException(`User with Firebase UID ${firebaseUid} not found.`);
    }

    // Update roles in your local database
    const updatedUser = await this.usersService.updateUserById(user.id, { roles });

    // Optional: Also set custom claims in Firebase for consistency
    // This makes roles available directly in Firebase ID tokens for client-side checks
    // Note: Changes to custom claims only affect *newly issued* Firebase ID tokens.
    // Existing tokens will still have old claims until they expire or are refreshed.
    await this.firebaseService.setCustomUserClaims(firebaseUid, { roles });

    return updatedUser;
  }
}