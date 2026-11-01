import { initializeApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";

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

// 📦 Storage (used by listing photo uploads)
export const storage = getStorage(app);

/**
 * OPTIONAL local Firebase emulator mode (development only).
 *
 * Enabled ONLY when ALL of the following are true:
 *   - NODE_ENV is "development" (never in a production build), AND
 *   - NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true", AND
 *   - the app is served from localhost/127.0.0.1, AND
 *   - NEXT_PUBLIC_FIREBASE_PROJECT_ID starts with "demo-" (a demo project ID).
 *
 * If the flag is on but any condition is not met, or an emulator cannot be
 * reached, we throw immediately so the app can NEVER silently fall back to
 * production. Production behavior is unchanged when the flag is off.
 */
const wantEmulators =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

function assertEmulatorPreconditions() {
  if (typeof window === "undefined") return; // server prerender: client will re-check
  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  const projectId = firebaseConfig.projectId;
  const isDemoProject = projectId.startsWith("demo-");
  if (!isLocalhost || !isDemoProject) {
    throw new Error(
      `[RVNB] Firebase emulator mode is enabled but misconfigured. ` +
      `It requires localhost and a "demo-" project ID. ` +
      `Got host="${host}", projectId="${projectId}". ` +
      `Refusing to continue so no production data is touched. ` +
      `Set NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false or fix the config.`
    );
  }
}

if (wantEmulators) {
  assertEmulatorPreconditions();
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    // Surface a clear console signal that we are NOT on production.
    console.warn(
      `[RVNB] Firebase EMULATOR mode active (project "${firebaseConfig.projectId}"). ` +
      `Auth/Firestore/Storage are pointed at local emulators, not production.`
    );
  } catch (error) {
    throw new Error(
      `[RVNB] Firebase emulator mode is enabled but the emulators could not be ` +
      `connected. Start them with "npm run emulators:demo" (see README) or set ` +
      `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false. Refusing to fall back to production. ` +
      `Cause: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
