import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { User, UserDocument } from './schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshTokenEntry } from './dtos/refresh-token.dto';
import { FirebaseService } from 'src/firebase/firebase.service';
import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>,
        private firebaseService: FirebaseService,) { }

    /**
     * Finds a user by their Firebase UID.
     * @param firebaseUid The Firebase UID of the user.
     * @returns The user object or undefined if not found.
     */
    async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
        return this.userModel.findOne({ uid: firebaseUid }).exec();
    }

    /**
     * Finds a user by their local database ID.
     * @param id The local database ID of the user.
     * @returns The user object or undefined if not found.
     */
    async findById(id: string): Promise<User | null> {
        return this.userModel.findById(id).exec();
    }

    /**
     * Creates a new user in the local database.
     * @param userData The partial user data to create.
     * @returns The newly created user object.
     */
    async createUser(userData: CreateUserDto): Promise<User> {
        return this.userModel.create(userData)
    }

    /**
     * Updates an existing user in the local database.
     * @param id The local database ID of the user to update.
     * @param updateData The partial user data to update.
     * @returns The updated user object.
     */
    async updateUserById(id: string, updateData: Partial<User>): Promise<User | null> {
        return this.userModel.findByIdAndUpdate(id, { updateData }, { new: true }).lean().exec()
    }

    /**
     * Retrieves all users. (For demonstration/admin purposes)
     * @returns An array of all user objects.
     */
    async findAll(): Promise<Partial<User>[]> {
        return this.userModel.find().lean().exec();
    }

    /**
   * Adds a new refresh token entry for a user.
   * @param userId The local ID of the user.
   * @param tokenEntry The new refresh token entry to add.
   * @returns The updated user.
   */
    async addRefreshToken(userId: string, tokenEntry: RefreshTokenEntry): Promise<User | null> {
        const user = await this.userModel.findById(userId).lean().exec();
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found.`);
        }
        user.refreshTokens = user.refreshTokens || []; // Ensure array exists
        user.refreshTokens.push(tokenEntry);
        return this.updateUserById(userId, { refreshTokens: user.refreshTokens });
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
        const user = await this.findById(userId);
        if (!user || !user.refreshTokens) {
            throw new NotFoundException(`User with ID ${userId} or their refresh tokens not found.`);
        }
        const tokenIndex = user.refreshTokens.findIndex(rt => rt.tokenHash === oldTokenHash);
        if (tokenIndex === -1) {
            throw new NotFoundException(`Refresh token not found for user ${userId}.`);
        }
        user.refreshTokens[tokenIndex] = newTokenEntry;
        return this.updateUserById(userId, { refreshTokens: user.refreshTokens });
    }

    /**
     * Removes a specific refresh token entry for a user.
     * Used for "logout from current device".
     * @param userId The local ID of the user.
     * @param tokenHash The hash of the refresh token to remove.
     * @returns The updated user.
     */
    async removeRefreshToken(userId: string, tokenHash: string): Promise<User | null> {
        const user = await this.findById(userId);
        if (!user || !user.refreshTokens) {
            throw new NotFoundException(`User with ID ${userId} or their refresh tokens not found.`);
        }
        user.refreshTokens = user.refreshTokens.filter(rt => rt.tokenHash !== tokenHash);
        return this.updateUserById(userId, { refreshTokens: user.refreshTokens });
    }

    /**
     * Removes all refresh tokens for a user.
     * Used for "logout from all devices".
     * @param userId The local ID of the user.
     * @returns The updated user.
     */
    async clearAllRefreshTokens(userId: string): Promise<User | null> {
        return this.updateUserById(userId, { refreshTokens: [] });
    }

    /**
     * Finds a refresh token entry by its hash for a given user.
     * @param userId The local ID of the user.
     * @param tokenHash The hash of the refresh token to find.
     * @returns The RefreshTokenEntry or undefined.
     */
    async findRefreshTokenEntry(userId: string, tokenHash: string): Promise<RefreshTokenEntry | undefined> {
        const user = await this.findById(userId);
        if (!user || !user.refreshTokens) {
            return undefined;
        }
        return user.refreshTokens.find(rt => rt.tokenHash === tokenHash);
    }

    // When a user signs up or requests to become a seller:
    async assignSellerRole(userId: string): Promise<User | null> {
        const user = await this.findById(userId);
        if (!user) throw new NotFoundException('User not found');
        if (!user.roles.includes(Role.Owner)) {
            user.roles.push(Role.Owner);
            // Firebase Custom Claims here for their Firebase ID token
            await this.firebaseService.setCustomUserClaims(user.uid, { roles: user.roles });
        }
        return this.updateUserById(userId, { roles: user.roles });
    }
}