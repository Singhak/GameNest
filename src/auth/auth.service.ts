import { Injectable, UnauthorizedException, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService, } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { FirebaseService } from '../firebase/firebase.service';
import { LoginDto } from './dtos/login.dto';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/schema/user.schema';
import { RefreshTokenEntry } from '../users/dtos/refresh-token.dto';
import { UpdateUserDto } from '../users/dtos/update-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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
    this.logger.log('Attempting user login...');
    const { idToken, currentLocation, clientInstanceId } = loginDto;

    if (!idToken) {
      throw new BadRequestException('Firebase ID token is required.');
    }

    try {
      // 1. Verify the Firebase ID token using Firebase Admin SDK
      const decodedToken = await this.firebaseService.verifyIdToken(idToken);
      this.logger.debug(`Firebase ID token verified for UID: ${decodedToken.uid}`);
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email || ''; // Email is often present in the token

      // 2. Check/create user in our local database
      // This is where you would interact with your actual database (e.g., MongoDB, PostgreSQL)
      let user = await this.usersService.findOneByQuery({ uid: firebaseUid });
      this.logger.debug(firebaseUid);

      if (!user) {
        // If user doesn't exist, create a new entry with a default role
        user = await this.usersService.createUser({
          uid: firebaseUid,
          email: email,
          roles: [Role.User],
          currentLocation
        });
        this.logger.log(`New user created in local DB: ${user.email} with UID: ${user.uid}`);
      } else {
        // For existing users, prepare updates and clean stale tokens
        const updates: UpdateUserDto = {};

        if (user.email !== email) {
          updates.email = email;
        }
        // Only update currentLocation if it's provided in the login DTO
        if (currentLocation !== undefined) {
          updates.currentLocation = currentLocation;
        }

        // Stale refresh token cleanup
        if (user.refreshTokens && user.refreshTokens.length > 0) {
          const now = new Date();
          const initialTokenCount = user.refreshTokens.length;
          let validRefreshTokens = user.refreshTokens.filter(rt => rt.expiresAt >= now);
          const sameClientTokens = validRefreshTokens.filter(rt => rt.deviceId === clientInstanceId);
          if (sameClientTokens.length) {
            validRefreshTokens = validRefreshTokens.filter(rt => rt.deviceId !== clientInstanceId);
            this.logger.log(`Removed ${ sameClientTokens.length} same Client Token`);
          }

          if (validRefreshTokens.length < initialTokenCount) {
            this.logger.log(`Removed ${initialTokenCount - validRefreshTokens.length} stale refresh token(s) for user ${user.email}`);
            updates.refreshTokens = validRefreshTokens;
          }
        }

        if (Object.keys(updates).length > 0) {
          const updatedUserDoc = await this.usersService.updateUserById(user.id, updates);
          if (updatedUserDoc) {
            user = updatedUserDoc; // Use the most up-to-date user document for JWT payload
          }
          this.logger.log(`Existing user ${user.email} (UID: ${user.uid}) updated with: ${Object.keys(updates).join(', ')} and logged in.`);
        } else {
          this.logger.log(`Existing user ${user.email} (UID: ${user.uid}) logged in. No stale tokens found or other details to update.`);
        }
      }

      // 3. Generate a custom JWT containing essential user info and roles
      // This JWT will be used for subsequent requests to our NestJS backend
      const payload = {
        uid: user.uid,
        email: user.email,
        roles: user.roles, // Roles from your local database
        id: user.id, // Subject of the token, typically the primary key in your database
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
      await this.addRefreshToken(user.id, {
        tokenHash: hashedRefreshToken,
        expiresAt: refreshTokenExpiresAt,
        issuedAt: issuedAt,
        deviceId: clientInstanceId // Include deviceId if sent from client
      });

      this.logger.log(`User ${user.email} logged in successfully. Issued tokens.`);
      return { accessToken, refreshToken };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`, error.stack);
      // Re-throw specific exceptions or a generic UnauthorizedException
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        // Log specific client errors at a lower level if needed
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
    this.logger.log(`Attempting to assign roles ${roles.join(', ')} to user with Firebase UID: ${firebaseUid}`);
    const user = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!user) {
      this.logger.warn(`User with Firebase UID ${firebaseUid} not found for role assignment.`);
      throw new BadRequestException(`User with Firebase UID ${firebaseUid} not found.`);
    }
    this.logger.debug(`User ${user.id} found. Updating roles.`);
    // Update roles in your local database
    const updatedUser = await this.usersService.updateUserById(user.id, { roles });

    // Optional: Also set custom claims in Firebase for consistency
    // This makes roles available directly in Firebase ID tokens for client-side checks
    // Note: Changes to custom claims only affect *newly issued* Firebase ID tokens.
    // Existing tokens will still have old claims until they expire or are refreshed.
    await this.firebaseService.setCustomUserClaims(firebaseUid, { roles });
    this.logger.log(`Roles ${roles.join(', ')} assigned to user ${user.id} (Firebase UID: ${firebaseUid}).`);

    return updatedUser;
  }

  /**
      * Hashes a refresh token before storing it in the database.
      * @param refreshToken The plain text refresh token.
      * @returns The hashed refresh token.
      */
  async hashRefreshToken(refreshToken: string): Promise<string> {
    const saltRounds = 10; // Adjust based on your security needs
    return bcrypt.hash(refreshToken, saltRounds);
  }

  /**
   * Verifies a refresh token against its stored hash.
   * @param refreshToken The plain text refresh token.
   * @param storedHash The stored hash to compare against.
   * @returns True if the token matches the hash, false otherwise.
   */
  async verifyRefreshToken(refreshToken: string, storedHash: string): Promise<boolean> {
    return bcrypt.compare(refreshToken, storedHash);
  }

  /**
* Adds a new refresh token entry for a user.
* @param userId The local ID of the user.
* @param tokenEntry The new refresh token entry to add.
* @returns The updated user.
*/
  async addRefreshToken(userId: string, tokenEntry: RefreshTokenEntry): Promise<User | null> {
    this.logger.debug(`Adding refresh token for user ${userId}`);
    const user = await this.usersService.findById(userId)
    if (!user) {
      this.logger.warn(`User not found for adding refresh token: ${userId}`);
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }
    user.refreshTokens = user.refreshTokens || []; // Ensure array exists
    user.refreshTokens.push(tokenEntry);
    return this.usersService.updateUserById(userId, { refreshTokens: user.refreshTokens });
  }

  /**
   * Updates an existing refresh token entry for a user.
   * Typically used during refresh token rotation.
   * @param userId The local ID of the user.
   * @param oldTokenHash The hash of the refresh token to replace.
   * @param newTokenEntry The new refresh token entry.
   * @returns The updated user.
   */
  async updateSpecificRefreshToken(userId: string, oldTokenHash: string, newTokenEntry: RefreshTokenEntry): Promise<User | null> {
    this.logger.debug(`Updating specific refresh token for user ${userId}`);
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokens) {
      throw new NotFoundException(`User with ID ${userId} or their refresh tokens not found.`);
    }
    this.logger.debug(`User found, searching for old token hash: ${oldTokenHash} to replace`);
    const tokenIndex = user.refreshTokens.findIndex(rt => rt.tokenHash === oldTokenHash);
    if (tokenIndex === -1) {
      throw new NotFoundException(`Refresh token not found for user ${userId}.`);
    }
    user.refreshTokens[tokenIndex] = newTokenEntry;
    return this.usersService.updateUserById(userId, { refreshTokens: user.refreshTokens });
  }

  /**
   * Removes a specific refresh token entry for a user.
   * Used for "logout from current device".
   * @param userId The local ID of the user.
   * @param tokenHash The hash of the refresh token to remove.
   * @returns The updated user.
   */
  async removeRefreshToken(userId: string, tokenHash: string): Promise<User | null> {
    this.logger.debug(`Removing refresh token for user ${userId}`);
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokens) {
      this.logger.warn(`User not found or no refresh tokens to remove: ${userId}`);
      throw new NotFoundException(`User with ID ${userId} or their refresh tokens not found.`);
    }
    user.refreshTokens = user.refreshTokens.filter(rt => rt.tokenHash !== tokenHash);
    return this.usersService.updateUserById(userId, { refreshTokens: user.refreshTokens });
  }

  /**
   * Removes all refresh tokens for a user.
   * Used for "logout from all devices".
   * @param userId The local ID of the user.
   * @returns The updated user.
   */
  async clearAllRefreshTokens(userId: string): Promise<User | null> {
    this.logger.log(`Clearing all refresh tokens for user ${userId}`);
    return this.usersService.updateUserById(userId, { refreshTokens: [] });
  }

  /**
   * Finds a refresh token entry by its hash for a given user.
   * @param userId The local ID of the user.
   * @param tokenHash The hash of the refresh token to find.
   * @returns The RefreshTokenEntry or undefined.
   */
  async findRefreshTokenEntry(userId: string, tokenHash: string): Promise<RefreshTokenEntry | undefined> {
    this.logger.debug(`Finding refresh token entry for user ${userId} with hash ${tokenHash}`);
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokens) {
      return undefined;
    }
    return user.refreshTokens.find(rt => rt.tokenHash === tokenHash);
  }

  async refreshAccessToken(userId: string, oldRefreshToken: string) {
    if (!userId || !oldRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token request');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // 2. Find and validate the refresh token
    const oldHashRefreshToken = await this.hashRefreshToken(oldRefreshToken);
    const tokenEntry = await this.findRefreshTokenEntry(userId, oldHashRefreshToken);

    if (!tokenEntry || tokenEntry.expiresAt < new Date()) {
      await this.removeRefreshToken(userId, oldHashRefreshToken); // Remove invalid token
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 3. Generate a custom JWT containing essential user info and roles
    // This JWT will be used for subsequent requests to our NestJS backend

    const payload = {
      uid: user.uid,
      email: user.email,
      roles: user.roles, // Roles from your local database
      id: user.id, // Subject of the token, typically the primary key in your database
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    const refreshTokenExpiresAt = new Date(Date.now() + parseInt(this.configService.get('jwt.refreshExpiresIn')?.replace('d', '')) * 24 * 60 * 60 * 1000); // Convert '7d' to milliseconds
    const issuedAt = new Date();

    await this.updateSpecificRefreshToken(userId, oldHashRefreshToken, {
      tokenHash: hashedRefreshToken,
      expiresAt: refreshTokenExpiresAt,
      issuedAt: issuedAt,
    });

    return {
      accessToken,
      refreshToken  // Send the *plain* new refresh token to the client
    };
  }
}