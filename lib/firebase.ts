import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

type FirebaseConfig = {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
    storageBucket?: string;
    messagingSenderId?: string;
};

const requiredEnv = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const optionalEnv = {
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

function assertConfig(env: typeof requiredEnv): FirebaseConfig {
    const missing = Object.entries(env)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length) {
        throw new Error(
            `Missing Firebase env values: ${missing.join(
                ", "
            )}. Add them to .env.local (NEXT_PUBLIC_...).`
        );
    }

    return {
        ...env,
        ...(optionalEnv.storageBucket ? { storageBucket: optionalEnv.storageBucket } : {}),
        ...(optionalEnv.messagingSenderId
            ? { messagingSenderId: optionalEnv.messagingSenderId }
            : {}),
    } as FirebaseConfig;
}

const firebaseConfig = assertConfig(requiredEnv);

// Ensure we only initialize once across hot reloads and server/client boundaries.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export { app };
