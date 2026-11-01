# Host Growth: proposed pilot, not an offer

## Public status and launch block

The public page says **“Grow your hosting potential.”** and
**“Pilot in development — register your interest.”**
It describes a proposed RVNB-funded pilot: one selected property, up to $500
total. No funding has been awarded, reserved, or guaranteed. Improvement Awards
are proposed nonrepayable support; Repayable Funding and Combined Support are
planned future options and unavailable now. No payments, agreements, deductions,
credit decisions, automatic awards, notifications, or recognition badges exist.

**Submission is intentionally disabled.** Repository inspection found no privacy
notice covering this collection. The client service and UI use a closed
`HOST_GROWTH_INTAKE_ENABLED` constant; Firestore independently denies creates
through `hostGrowthIntakeEnabled()`. Neither an environment variable nor a
client-supplied flag can open the rules gate.

Before enabling collection, the operator must obtain and publish an approved
notice covering the actual purpose, fields, authorized access, contact permission,
retention/deletion process, and applicable host privacy rights/contact channel.
No policy or retention period is invented here. Once approved, make a separately
reviewed change to link it before submission, record its actual version with each
registration, update the strict schema/tests, and deliberately enable both gates.
The public paused wording and entry-card notice must also be updated at that time.

## Registration contract

User-approved duplicate policy: **one registration per owned listing, plus one
proposed-property registration per account for pilot-01**.

Collection: `hostGrowthRegistrations`.
IDs: `{uid}__listing__{listingId}` or `{uid}__proposed`.
Registrations are immutable to clients. A transaction pre-reads the deterministic
ID; retry after a lost response reports an existing registration rather than
overwriting it. Distinct listings can register independently. There is no
self-service amendment or deletion in this release; establish a staff privacy
request workflow before intake opens. This is not comprehensive anti-abuse or
multi-account rate limiting.

Allowed fields:

| Field | Contract |
| --- | --- |
| schemaVersion / pilotId | integer 1 / `pilot-01` |
| ownerId | authenticated UID |
| listingId | owned listing ID, or null for proposed property |
| city / stateRegion | 1–80 characters for proposed property; empty for a listing |
| category | Wi-Fi coverage, Entrance signage, Listing photography, Site preparation |
| description | 20–1,000 characters; asks hosts to omit sensitive details |
| estimatedCostCents | integer 1–10,000,000 (USD estimate, not approved budget) |
| requestedSupportCents | integer 1–50,000, no greater than estimated cost |
| propertyPermission / contactConsent | both true |
| contactEmail | email-shaped string, at most 254 characters; not identity verification |
| status / createdAt | `registered` / server timestamp equal to request time |

The form asks only general city/region for an unlisted property. An owned listing
is referenced, not copied; no precise address, photos, profile, or reviews are
collected. Free text cannot technically prevent a host from typing private data;
the UI explicitly warns against it. Do not add analytics that capture form values.
No client persistence is used for unfinished forms.

## Access and operations

Rules verify current `listings/{listingId}.hostId` at create time; client checks
are only usability protection. Authentication alone, not a public profile or
review history, is required. Creates cannot spoof ownership, add arbitrary fields,
use alternate IDs, backdate, or claim approval. Owners can get their own records
and query with `ownerId == auth.uid`. Missing deterministic IDs may be pre-read
only under the caller's UID prefix. Public and cross-user reads are denied.
Updates/deletes are denied; there is no browser administrator role.

No staff UI or notification pipeline is implemented. After privacy/operations
approval, individually authorized RVNB staff would inspect the collection in
the Firebase/Google Cloud Firestore console using explicitly granted project IAM
access, or a separately reviewed privileged backend. Console/server credentials
bypass client rules and may expose other project collections: review that
broader IAM scope, use individual accounts, audit access, and never distribute
admin credentials to the web app. This code does not grant IAM roles.
Staff must have an approved handling, retention, deletion, review, and permitted
email-contact process before launch. Do not imply registration triggers email.

## Tests and deployment prerequisites

Run:

```text
node --test host-growth.test.js
npx firebase emulators:exec --only firestore --project demo-rvnb-rules-test "node --test --test-concurrency=1 host-growth.test.js firestore.rules.test.js"
npx tsc --noEmit
npm run build
```

The new emulator test first proves the real closed gate denies create, then
replaces only that gate **in the emulator's in-memory rule source** to exercise
the prospective schema/access/duplicate contract. It never changes the rules file
or deploys an open gate. Without an emulator that test explicitly skips.

Shared integration changes are additive: a homepage card below featured stays,
a host-dashboard sidebar card, and one dedicated rules helper/match block.
Existing rule changes belonging to other repairs are preserved, not reworked.
No indexes, dependencies, Firebase initialization, billing, or paid services
are changed. Owner-only equality reads use existing automatic single-field
indexes.

Before an approved release, integrate/review the shared rules alongside the
other pending repair package, run regression tests, deploy the reviewed rules
before the application, and verify the closed state remains closed. Opening
intake is a separate approval after the privacy and operational prerequisites,
not authorized by this implementation. Funding offers and financial/legal terms
would require their own future approvals and implementation.
