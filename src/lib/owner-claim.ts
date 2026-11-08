// Owner authorization is a server-managed Firebase custom claim (`owner: true`)
// on the ID token. It can only be provisioned through the documented UID-based
// procedure in docs/owner-dashboard.md — never by client code, profile writes,
// or signup. This check mirrors the Firestore rules `isOwner()` semantics:
// strictly boolean true; a missing claim or a truthy look-alike does not count.
export function hasOwnerClaim(claims: unknown): boolean {
  return Boolean(
    claims &&
      typeof claims === "object" &&
      (claims as Record<string, unknown>).owner === true
  );
}
