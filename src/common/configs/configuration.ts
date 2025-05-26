import * as path from 'path';

// Define a function that returns the configuration object
export default () => ({
    port: parseInt(process.env.PORT || '3000', 10),
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRATION_TIME || '1h',
    },
    firebase: {
        // Resolve the path to the service account key file
        serviceAccountPath: path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json'),
    },
});