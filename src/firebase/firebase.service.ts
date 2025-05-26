import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseAdmin: typeof admin;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Get the service account path from configuration
    const serviceAccountPath = this.configService.get<string>('firebase.serviceAccountPath');

    if (!serviceAccountPath) {
      throw new InternalServerErrorException('Firebase service account path is not configured.');
    }

    // Check if the service account file exists
    if (!fs.existsSync(serviceAccountPath)) {
      throw new InternalServerErrorException(
        `Firebase service account file not found at: ${serviceAccountPath}. Please ensure it exists and is correctly placed.`
      );
    }

    try {
      // Initialize Firebase Admin SDK only if it hasn't been initialized yet
      if (!admin.apps.length) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin SDK initialized successfully.');
      }
      this.firebaseAdmin = admin;
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error.message);
      throw new InternalServerErrorException('Failed to initialize Firebase Admin SDK.');
    }
  }

  /**
   * Returns the initialized Firebase Admin SDK instance.
   */
  getAdmin(): typeof admin {
    if (!this.firebaseAdmin) {
      throw new InternalServerErrorException('Firebase Admin SDK not initialized.');
    }
    return this.firebaseAdmin;
  }

  /**
   * Verifies a Firebase ID token.
   * @param idToken The Firebase ID token to verify.
   * @returns The decoded Firebase ID token.
   */
  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    try {
      return await this.getAdmin().auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error.message);
      throw new InternalServerErrorException('Failed to verify Firebase ID token.');
    }
  }

  /**
   * Sets custom claims for a Firebase user.
   * @param uid The UID of the user.
   * @param customClaims The custom claims to set.
   */
  async setCustomUserClaims(uid: string, customClaims: { [key: string]: any }): Promise<void> {
    try {
      await this.getAdmin().auth().setCustomUserClaims(uid, customClaims);
      console.log(`Custom claims set for user ${uid}:`, customClaims);
    } catch (error) {
      console.error(`Error setting custom claims for user ${uid}:`, error.message);
      throw new InternalServerErrorException('Failed to set custom user claims.');
    }
  }
}