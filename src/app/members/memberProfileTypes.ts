export type MemberProfileVisibility = "public" | "private";

export type MemberProfileDoc = {
  userId: string;
  displayName: string;
  city?: string | null;
  state?: string | null;
  bio?: string | null;
  photoURL?: string | null;
  visibility: MemberProfileVisibility;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const MEMBER_PROFILE_LIMITS = {
  displayName: 60,
  city: 80,
  state: 40,
  bio: 500,
} as const;

export function isValidUserIdParam(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 128;
}
