import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { User, UserDocument } from './schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>){}
    // In a real application, this would be your database interaction layer
    // For simplicity, we're using an in-memory array.
    private users: Partial<User>[] = [
        // Seed an admin user for testing
        {
            uid: 'firebase-admin-uid-example', // Replace with an actual Firebase UID if you have one for testing
            email: 'admin@example.com',
            roles: [Role.Admin, Role.User],
        },
        {
            uid: 'firebase-editor-uid-example',
            email: 'editor@example.com',
            roles: [Role.Editor, Role.User],
        },
    ];
    private nextId = 1000; // Simple ID generator for new users

    /**
     * Finds a user by their Firebase UID.
     * @param firebaseUid The Firebase UID of the user.
     * @returns The user object or undefined if not found.
     */
    async findByFirebaseUid(firebaseUid: string): Promise<Partial<User> | undefined> {
        return this.users.find(user => user.uid === firebaseUid);
    }

    /**
     * Finds a user by their local database ID.
     * @param id The local database ID of the user.
     * @returns The user object or undefined if not found.
     */
    async findById(id: string): Promise<Partial<User> | undefined> {
        return this.users.find(user => user.id === id);
    }

    /**
     * Creates a new user in the local database.
     * @param userData The partial user data to create.
     * @returns The newly created user object.
     */
    async createUser(userData: Partial<User>): Promise<Partial<User>> {
        const newUser: Partial<User> = {
            uid: userData.uid,
            email: userData.email,
            roles: userData.roles || [Role.User], // Default to 'user' role if not provided
        };
        return this.userModel.create(newUser)
    }

    /**
     * Updates an existing user in the local database.
     * @param id The local database ID of the user to update.
     * @param updateData The partial user data to update.
     * @returns The updated user object.
     */
    async updateUser(id: string, updateData: Partial<User>): Promise<Partial<User>> {
        const userIndex = this.users.findIndex(user => user.id === id);
        if (userIndex === -1) {
            throw new NotFoundException(`User with ID ${id} not found.`);
        }
        this.users[userIndex] = { ...this.users[userIndex], ...updateData };
        return this.users[userIndex];
    }

    /**
     * Retrieves all users. (For demonstration/admin purposes)
     * @returns An array of all user objects.
     */
    async findAll(): Promise<Partial<User>[]> {
        return this.users;
    }
}