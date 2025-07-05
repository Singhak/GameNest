import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Storage } from 'firebase-admin/storage';
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseAdmin: typeof admin;
  private storage: Storage;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Get the service account path from configuration
    const serviceAccountPath = this.configService.get<string>('firebase.serviceAccountPath');
    const storageBucket = this.configService.get<string>('firebase.storageBucket');

    if (!serviceAccountPath) {
      throw new InternalServerErrorException('Firebase service account path is not configured.');
    }

    // Check if the service account file exists
    if (!fs.existsSync(serviceAccountPath)) {
      throw new InternalServerErrorException(
        `Firebase service account file not found at: ${serviceAccountPath}. Please ensure it exists and is correctly placed.`
      );
    }

    if (!storageBucket) {
      throw new InternalServerErrorException('Firebase storage bucket URL is not configured in firebase.storageBucket.');
    }

    try {
      // Initialize Firebase Admin SDK only if it hasn't been initialized yet
      if (!admin.apps.length) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket,
        });
        console.log('Firebase Admin SDK initialized successfully.');
      }
      this.firebaseAdmin = admin;
      this.storage = admin.storage();
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

  /**
   * Uploads a file to Firebase Storage.
   * @param buffer The file buffer to upload.
   * @param destination The path in the bucket where the file will be stored.
   * @param mimetype The MIME type of the file.
   * @returns The public URL of the uploaded file.
   */
  async uploadFile(buffer: Buffer, destination: string, mimetype: string): Promise<string> {
    const bucket = this.storage.bucket();
    const file = bucket.file(destination);

    try {
      await file.save(buffer, {
        public: true,
        contentType: mimetype,
        metadata: {
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
        },
      });

      return file.publicUrl();
    } catch (error) {
      console.error(`Error uploading file to ${destination}:`, error.message);
      throw new InternalServerErrorException('Failed to upload file.');
    }
  }

  /**
   * Deletes a file from Firebase Storage.
   * @param filePath The path of the file to delete in the bucket.
   */
  async deleteFile(filePath: string): Promise<void> {
    const bucket = this.storage.bucket();
    const file = bucket.file(filePath);

    try {
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        console.log(`Successfully deleted ${filePath} from storage.`);
      } else {
        console.log(`File ${filePath} does not exist in storage, skipping deletion.`);
      }
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error.message, error.stack);
      // Do not re-throw, as this is often a non-critical cleanup operation.
    }
  }

  /**
   * Extracts the file path from a Firebase Storage public URL.
   * @param url The public URL of the file.
   * @returns The file path within the bucket, or null if the URL is invalid.
   */
  extractFilePathFromUrl(url: string): string | null {
    try {
      const bucketName = this.storage.bucket().name;
      const urlObject = new URL(url);
      const expectedPrefix = `/${bucketName}/`;

      if (urlObject.hostname === 'storage.googleapis.com' && urlObject.pathname.startsWith(expectedPrefix)) {
        return decodeURIComponent(urlObject.pathname.substring(expectedPrefix.length));
      }
      return null;
    } catch (error) {
      console.error(`Could not parse file path from URL: ${url}`, error.message);
      return null;
    }
  }
}