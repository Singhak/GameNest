import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { User, UserDocument } from './schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import * as path from 'path';

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

    // --- Favorite Club Management ---

    /**
     * Adds or removes a club from a user's favorites list.
     * @param userId The ID of the user.
     * @param clubId The ID of the club to toggle.
     * @returns A confirmation message.
     */
    async toggleFavoriteClub(userId: string, clubId: string): Promise<{ message: string }> {
        this.logger.log(`User ${userId} toggling favorite status for club ${clubId}`);
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found.');
        }

        const clubObjectId = new Types.ObjectId(clubId);
        const favoriteClubs = user.favoriteClubs.map(id => id.toString());
        const isFavorite = favoriteClubs.includes(clubId);

        let update;
        let message;

        if (isFavorite) {
            // Remove from favorites
            update = { $pull: { favoriteClubs: clubObjectId } };
            message = 'Club removed from favorites.';
        } else {
            // Add to favorites
            update = { $addToSet: { favoriteClubs: clubObjectId } }; // $addToSet prevents duplicates
            message = 'Club added to favorites.';
        }

        await this.userModel.updateOne({ _id: user._id }, update);
        this.logger.log(message);
        return { message };
    }

    /**
     * Retrieves a user's list of favorite clubs.
     * @param userId The ID of the user.
     * @returns A list of the user's favorite SportClub documents.
     */
    async getFavoriteClubs(userId: string): Promise<any[]> {
        this.logger.debug(`Fetching favorite clubs for user ${userId}`);
        const user = await this.userModel.findById(userId).populate('favoriteClubs').select('favoriteClubs').lean().exec();

        if (!user) {
            throw new NotFoundException('User not found.');
        }

        return user.favoriteClubs;
    }

    /**
     * Uploads a user's avatar to Firebase Storage and updates the user's profile.
     * @param userId The ID of the user.
     * @param file The uploaded file object from Multer.
     * @returns The updated user object with the new avatar URL.
     */
    async uploadAvatar(userId: string, file: Express.Multer.File): Promise<User> {
        const user = await this.findById(userId);
        if (!user) {
            this.logger.error(`User with ID ${userId} not found for avatar upload.`);
            throw new NotFoundException('User not found.');
        }

        // Optional but recommended: Delete the old avatar to save storage space.
        if (user.avatar) {
            try {
                // This assumes your FirebaseService has methods to parse the URL and delete the old file.
                // A simple implementation might extract the file path from the public URL.
                const oldFilePath = this.firebaseService.extractFilePathFromUrl(user.avatar);
                if (oldFilePath) {
                    this.logger.log(`Deleting old avatar for user ${userId}: ${oldFilePath}`);
                    await this.firebaseService.deleteFile(oldFilePath);
                }
            } catch (error) {
                this.logger.error(`Failed to delete old avatar for user ${userId}. URL: ${user.avatar}`, error.stack);
                // This is a non-fatal error, so we'll log it and continue with the new upload.
            }
        }

        const fileExtension = path.extname(file.originalname);
        const filename = `avatars/${userId}/${Date.now()}${fileExtension}`;
        this.logger.log(`Uploading new avatar for user ${userId} to ${filename}`);

        const publicUrl = await this.firebaseService.uploadFile(file.buffer, filename, file.mimetype);

        const updatedUser = await this.updateUserById(userId, { avatar: publicUrl });
        if (!updatedUser) {
            // This case is unlikely if the user was found initially, but it's good practice to handle.
            throw new NotFoundException('User not found after update attempt.');
        }

        return updatedUser;
    }
}