import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

/**
 * Firebase config pulled from .env.local
 * Make sure these exist in your .env.local at the project root.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

/**
 * ✅ Debug (TEMP)
 * This prints in your terminal so we can verify your env vars are actually loading.
 * If any show "undefined", your .env.local is not being read.
 *
 * Once everything works, you can delete these logs.
 */
console.log("🔥 FIREBASE ENV CHECK");
console.log("🔥 API KEY LOADED:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log("🔥 AUTH DOMAIN:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
console.log("🔥 PROJECT ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log("🔥 STORAGE BUCKET:", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
console.log("🔥 SENDER ID:", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
console.log("🔥 APP ID:", process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

// ✅ Prevent re-initializing Firebase in Next dev/hot reload
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// 🔥 Firestore
export const db = getFirestore(app);

// 🔐 Auth
export const auth = getAuth(app);

// 🌐 Google Provider (for later)
export const googleProvider = new GoogleAuthProvider();
