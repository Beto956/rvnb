# RVNB Owner Dashboard

A private, read-only administrative workspace at `/owner` for the RVNB site
owner. It is not a public creator profile, not a paid membership tier, and it
performs no administrative writes (no editing, deleting, approving, refunds, or
bulk actions).

## Owner identity: Firebase custom claim

Owner access is controlled by a **server-managed Firebase custom claim**
`owner: true` on the user's ID token.

- The claim can only be set through the provisioning procedure below, which
  requires the firebase-tools CLI login of a Firebase project editor/owner.
- Clients cannot set it: Firestore rules never read it from a document, the
  `users/{uid}` profile schema has no owner field, and there is no signup or
  settings UI for it.
- Email addresses, client-side flags, local storage, and editable profile
  fields are **never** trusted for owner authorization.
- Firestore rules check `request.auth.token.get('owner', false) == true` via
  `isOwner()`. The `Map.get` default matters: direct property access on a token
  without the claim errors (denying unrelated access), instead of evaluating
  to false.
- The browser hook (`src/lib/use-is-owner.ts`) reads the claim with
  `getIdTokenResult()` and re-checks on token refresh, sign-out, and account
  switching, so revoked access disappears without stale private data.

## Provisioning and revocation procedure

Prerequisites:

1. `npx firebase login` with an account that can manage the target project.
2. The **exact Firebase Authentication UID** of the owner account, copied from
   the Firebase console (Authentication → Users). Do not guess or pick the
   first account; confirm the UID with the account holder before granting.

Commands (production project `rvnb-latest`):

```powershell
# Check current claims for a UID (read-only)
node scripts/owner-claim.cjs --project rvnb-latest --uid <EXACT_UID> --check

# Grant the owner claim
node scripts/owner-claim.cjs --project rvnb-latest --uid <EXACT_UID> --grant --yes

# Revoke the owner claim
node scripts/owner-claim.cjs --project rvnb-latest --uid <EXACT_UID> --revoke --yes
```

The script merges with any existing custom claims (it never silently drops
other claims), prints the before/after claim set, and verifies the result.
It uses the CLI's stored OAuth login; no service-account keys, tokens, or
privileged secrets are stored in this repo or exposed to the browser.

**Claim refresh:** after a grant or revocation, the user must sign out and
back in (or wait for the hourly token refresh) before the change takes effect.

**Revocation timing (verified against the demo emulators):** revoking the
claim does **not** immediately lock out an already-open dashboard. The signed-in
session keeps its current ID token until it refreshes (Firebase refreshes
roughly hourly) or the user signs out. The dashboard re-checks the claim on
every token refresh, sign-out, and account switch, so access disappears at the
next refresh at the latest — but there can be a delay of up to about an hour
for an idle open tab. To revoke access promptly, revoke the claim **and** have
the user sign out (or revoke their refresh tokens in Firebase Authentication,
which forces re-authentication).

**Demo emulator:** for local testing against the Auth emulator:

```powershell
node scripts/owner-claim.cjs --emulator --project demo-rvnb-local --uid <UID> --grant --yes
```

## What the owner can read

`isOwner()` grants read-only access to exactly the collections the dashboard
displays. Everything else is unchanged, and owner **writes** remain denied
everywhere (owners keep only the same write capabilities their normal
member/host role already gives them on their own records).

| Collection | Before | Owner addition |
| --- | --- | --- |
| `users` | self only | read any user record (role, display name) |
| `memberProfiles` | public profiles + self | read any profile incl. private visibility |
| `listings` | public read | unchanged (already public) |
| `bookings` | guest/host/listing host | read any booking/stay inquiry |
| `spotRequests` | requester | read any request incl. drafts |
| `spotRequestPublic` | hosts + requester | read any public projection |
| `spotRequestPrivate` | requester | read requester contact details (detail views only) |
| `hostOpportunities` | linked host/requester | read any host response or host application |
| `transportRequests` | requester | read any transport request |
| `transportProviders` | registrant | read any provider registration |
| `transportInterest` | submitter, no list | read + list general-interest submissions |
| `reviews` | published only | read any review |
| `reviewReports` | none (write-only) | read + list review moderation reports |
| `communityPosts` | active + author | read any post incl. removed |
| `communityPosts/replies` | active + author | read any reply incl. removed |
| `communityReports` | reporter, no list | read + list community moderation reports |

Deliberately **not** granted (not dashboard datasets; least privilege):
`insuranceInterest`, `insuranceProviders`, `communityInterest`,
`hostGrowthRegistrations`, `listingReservations`, `dayMeta`.

## Data-protection rules for the UI

- Overview shows operational counts first (server-side aggregation via
  `getCountFromServer`, no full-collection downloads).
- Contact information appears only inside protected detail views.
- Lists are bounded (`limit` + "Load more" pagination); nothing downloads
  whole collections for display, filtering, or search.
- **Legacy records without `createdAt`:** date-ordered lists only show records
  that have the ordering field. Firestore cannot query for a missing field, so
  each section derives the gap as `total records − orderable records` (two
  bounded server-side aggregations, no documents downloaded) and labels it,
  e.g. "Showing 10 of 12 timestamped records · 2 older records without a
  timestamp not listed." Totals therefore stay honest about incomplete lists.
  No production records are migrated to fix this.
- No administrative dataset is persisted to local storage or shared caches.
- Self-reported data (host applications, provider registrations) is labeled
  as self-reported; nothing is presented as verified unless the schema
  actually records verification.
- Missing fields render as "unknown"/"not provided"; nothing is invented.

## Deployment requirements

- `firestore.rules` must be deployed before (or with) the dashboard release;
  without the `isOwner()` rules the dashboard simply shows its error state.
- No new composite indexes are required: dashboard queries are single-field
  `orderBy`/`where` on one collection at a time.
- The production claim grant is a separate, explicit step performed only after
  the exact owner UID is confirmed.
