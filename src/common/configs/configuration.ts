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
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
        },
    };
};
