import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type AdminEnv = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

const env: AdminEnv = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
};

const hasAdminConfig = Object.values(env).every(Boolean);

if (!hasAdminConfig) {
  console.warn(
    "[firebase-admin] Missing admin credentials (FIREBASE_ADMIN_*). " +
      "Server actions depending on admin access will fail until set.",
  );
}

const app =
  getApps().find((a) => a.name === "[admin]") ??
  (hasAdminConfig
    ? initializeApp(
        {
          credential: cert({
            projectId: env.projectId!,
            clientEmail: env.clientEmail!,
            privateKey: env.privateKey!.replace(/\\n/g, "\n"),
          }),
        },
        "[admin]",
      )
    : undefined);

export const adminFirestore = app ? getFirestore(app) : undefined;
