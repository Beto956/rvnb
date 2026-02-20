// src/lib/auth-redirect.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export type UserRole = "host" | "guest";

export async function getUserRole(uid: string): Promise<UserRole> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  // default role if doc missing
  const role = (snap.exists() ? (snap.data() as any).role : "guest") as UserRole;
  return role === "host" ? "host" : "guest";
}

export async function getRedirectPathForUser(uid: string): Promise<string> {
  const role = await getUserRole(uid);
  return role === "host" ? "/host" : "/listings";
}
