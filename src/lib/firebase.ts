import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

/**
 * Firebase config pulled from .env.local
 * NOTE: In Next.js client bundles, process.env is replaced at build time.
 * Avoid dynamic checks like process.env[key] + throwing during module evaluation.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

// ✅ Only warn (don’t crash the whole app at import time)
if (!firebaseConfig.apiKey) {
  console.warn(
    "⚠️ Firebase env vars missing. Check your .env.local at the project root and restart dev server."
  );
}

// ✅ Prevent re-initializing Firebase in Next dev/hot reload
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// 🔥 Firestore
export const db = getFirestore(app);

// 🔐 Auth
export const auth = getAuth(app);

// 🌐 Google Provider (for later)
export const googleProvider = new GoogleAuthProvider();
