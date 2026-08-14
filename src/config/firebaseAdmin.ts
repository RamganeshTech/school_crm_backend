// config/firebaseAdmin.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!, 'base64').toString('utf-8')
);

initializeApp({
    credential: cert(serviceAccount),
});

export const messaging = getMessaging();