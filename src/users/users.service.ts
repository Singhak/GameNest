import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { User, UserDocument } from './schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshTokenEntry } from './dtos/refresh-token.dto';
import { FirebaseService } from 'src/firebase/firebase.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>,
        private firebaseService: FirebaseService,) { }

    /**
     * Finds a user by their Firebase UID.
     * @param firebaseUid The Firebase UID of the user.
     * @returns The user object or undefined if not found.
     */
    async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
        this.logger.debug(`Finding user by Firebase UID: ${firebaseUid}`);
        return this.userModel
            .findOne({ uid: firebaseUid })
            .select('-refreshTokens -updatedAt -__v -fcmTokens') // Exclude specified fields
            .exec();
    }

    /**
     * 
     * @param query 
     * @returns An array of all user objects.
     */
    async findByQuery(query: any): Promise<User[]> {
        this.logger.debug(`Finding users by query: ${JSON.stringify(query)}`);
        return this.userModel.find(query).lean().exec();
    }

    /**
     * 
     * @param query 
     * @returns The user object or undefined if not found
     */
    async findOneByQuery(query: any): Promise<User | null> {
        this.logger.debug(`Finding users by query: ${JSON.stringify(query)}`);
        return this.userModel.findOne(query).exec();
    }


    /**
     * Finds a user by their local database ID.
     * @param id The local database ID of the user.
     * @returns The user object or undefined if not found.
     */
    async findById(id: string): Promise<User | null> {
        this.logger.debug(`Finding user by local ID: ${id}`);
        return this.userModel.findById(id).exec();
    }

    /**
     * Creates a new user in the local database.
     * @param userData The partial user data to create.
     * @returns The newly created user object.
     */
    async createUser(userData: CreateUserDto): Promise<User> {
        this.logger.log(`Creating new user with UID: ${userData.uid}`);
        return this.userModel.create(userData)
    }

    /**
     * Updates an existing user in the local database.
     * @param id The local database ID of the user to update.
     * @param updateData The partial user data to update.
     * @returns The updated user object.
     */
    async updateUserById(id: string, updateData: UpdateUserDto): Promise<User | null> {
        this.logger.debug(`Updating user by ID: ${id} with data: ${JSON.stringify(updateData)}`);
        return this.userModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    }

    /**
     * Retrieves all users. (For demonstration/admin purposes)
     * @returns An array of all user objects.
     */
    async findAll(): Promise<Partial<User>[]> {
        this.logger.debug('Finding all users');
        return this.userModel.find().lean().exec();
    }

    /**
     * Assigns the 'Owner' role to a user and updates their Firebase Custom Claims.
     * @param userId The local ID of the user.
     * @returns The updated user object.
     * @throws NotFoundException if the user is not found.
     */

    async assignOwnerRole(userId: string): Promise<User | null> {
        this.logger.log(`Attempting to assign Owner role to user ${userId}`);
        const user = await this.findById(userId);
        if (!user) throw new NotFoundException('User not found');
        this.logger.debug(`User ${userId} found. Current roles: ${user.roles}`);
        if (!user.roles.includes(Role.Owner)) {
            user.roles.push(Role.Owner);
            // Firebase Custom Claims here for their Firebase ID token
            await this.firebaseService.setCustomUserClaims(user.uid, { roles: user.roles });
        }
        return this.updateUserById(userId, { roles: user.roles });
    }

    // --- FCM Token Management Methods ---
    /**
     * Adds a new FCM token for a user.
     * Ensures uniqueness of tokens for a user.
     * @param userId The local ID of the user.
     * @param fcmToken The FCM token to add.
     * @returns The updated user.
     */

    async addFcmToken(userId: string, fcmToken: string): Promise<User | null> { // Corrected method name
        this.logger.debug(`Adding FCM token for user ${userId}`);
        const user = await this.findById(userId);
        if (!user) {
            this.logger.warn(`User not found for adding FCM token: ${userId}`);
            throw new NotFoundException(`User with ID ${userId} not found.`);
        }
        user.fcmTokens = user.fcmTokens || [];
        if (!user.fcmTokens.includes(fcmToken)) {
            user.fcmTokens.push(fcmToken);
            return this.updateUserById(userId, { fcmTokens: user.fcmTokens });
        }
        return user; // Token already exists, no update needed
    }

    /**
     * Removes a specific FCM token for a user.
     * Used when a device unsubscribes or a token becomes invalid.
     * @param userId The local ID of the user.
     * @param fcmToken The FCM token to remove.
     * @returns The updated user.
     */
    async removeFcmToken(userId: string, fcmToken: string): Promise<User | null> {
        this.logger.debug(`Removing single FCM token for user ${userId}`);
        const user = await this.findById(userId);
        if (!user || !user.fcmTokens) {
            this.logger.warn(`User not found for removing FCM token: ${userId}`);
            throw new NotFoundException(`User with ID ${userId} or their FCM tokens not found.`);
        }
        user.fcmTokens = user.fcmTokens.filter(token => token !== fcmToken);
        return this.updateUserById(userId, { fcmTokens: user.fcmTokens });
    }

    /**
     * Removes multiple specified FCM tokens for a user.
     * Useful for cleaning up multiple invalid tokens received from FCM feedback.
     * @param userId The local ID of the user.
     * @param tokensToRemove An array of FCM tokens to remove.
     * @returns The updated user.
     */

    async removeFcmTokens(userId: string, tokensToRemove: string[]): Promise<User | null> {
        this.logger.debug(`Removing multiple FCM tokens for user ${userId}: ${tokensToRemove.join(', ')}`);
        const user = await this.findById(userId);
        if (!user || !user.fcmTokens) { // Check if user or fcmTokens exist
            this.logger.error(`User with ID ${userId} or their FCM tokens not found.`)
            throw new NotFoundException(`User with ID ${userId} or their FCM tokens not found.`);
        }
        user.fcmTokens = user.fcmTokens.filter(token => !tokensToRemove.includes(token));
        return this.updateUserById(userId, { fcmTokens: user.fcmTokens });
    }

    async findClubOwners(clubId: string): Promise<User[]> {
        this.logger.debug(`Finding club owners for club ${clubId}`);
        return this.userModel.find({ ownedClubs: clubId, roles: Role.Owner }).exec();
    }
}