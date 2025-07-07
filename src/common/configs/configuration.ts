import * as path from 'path';
export default () => {
    const mongodbUri = process.env.MONGODB_URI || '';
    return {
        port: parseInt(process.env.PORT || '3000', 10),
        mongodbUri,
        jwt: {
            secret: process.env.JWT_SECRET,
            expiresIn: process.env.JWT_EXPIRATION_TIME || '1h',
            refreshSecret: process.env.JWT_REFRESH_SECRET,
            refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION_TIME || '7d',
        },
        firebase: {
            serviceAccountPath: path.resolve(
                process.cwd(),
                process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json',
            ),
            serviceAccount: {
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            },
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
        },
    };
};
