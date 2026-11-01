This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Local Firebase demo emulators (development only)

You can run the app against local Firebase emulators (Auth, Firestore, Storage)
so signed-in flows can be tested without touching production data.

**Start the emulators** (in one terminal):

```bash
npm run emulators:demo
```

This starts Auth (9099), Firestore (8080), and Storage (9199) against the demo
project `demo-rvnb-local`. Leave it running.

**Run the dev server against the emulators** (in a second terminal), with these
environment variables set:

```bash
# Windows PowerShell
$env:NEXT_PUBLIC_USE_FIREBASE_EMULATORS="true"
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID="demo-rvnb-local"
npm run dev
```

Emulator mode is enabled **only** when all of these hold: `NODE_ENV=development`,
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, the app is served from
`localhost`/`127.0.0.1`, and the project ID starts with `demo-`. If the flag is
on but any condition is unmet or an emulator is unreachable, the app throws at
startup and **never falls back to production**. When the flag is off, production
behavior is unchanged.

**Stop the demo environment:** stop the dev server, then press `Ctrl+C` in the
emulator terminal. To return to production, unset
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS` (or set it to `false`) and restart the dev
server with your normal `.env.local` project settings.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Transport intake

`/transport` is an early-access information and intake hub, not an operational
transport marketplace. `/transport/request` collects private requests;
`/transport/provider` collects private provider registrations. The interest form
records general interest separately. All submissions require sign-in.

- Existing collections remain `transportRequests`, `transportProviders`, and
  `transportInterest`; no schema, rules, index, or access changes are introduced.
  Current rules allow owner creation/get only, with no public/cross-user reads,
  client lists, updates, or deletes. Provider declarations are not verified.
- There is no request board, provider directory, automated matching, quotation,
  scheduling, messaging, tracking, payment, transport review, or booking workflow.
  No staff notification is implemented. Authorized operations would need
  appropriately scoped Firebase/Google Cloud IAM access or a separately designed
  server-side staff workflow; no administrator privileges are added to clients.
- Request drafts are retained in browser session storage while editing and across
  sign-in. Provider drafts use the existing session-storage flow. Inputs remain
  editable after a failed write. Successful writes clear drafts without turning
  a storage-cleanup failure into a failed-submission message.
- Synchronous guards prevent double-click/concurrent writes and repeat submissions
  from the mounted success state. These are not durable server idempotency keys:
  reloads, other tabs, or ambiguous network outcomes can still cause duplicates.
- Request length is currently required and approximate (feet); weight is optional
  (pounds), with legacy omission normalized to zero. Height, width, explicit
  known/estimated status, and structured hitch details are not collected. Do not
  invent values. Adding unknown-length support or these fields requires coordinated
  schema/rules/downstream design, not only UI controls.

Validate with `node --test transport.test.js`, TypeScript, changed-file ESLint,
and `npm run build`. Focused privacy tests:
`npx firebase emulators:exec --only firestore --project demo-rvnb-rules-test "node --test --test-name-pattern=transport firestore.rules.test.js"`.
Use demo fixtures/emulators for writes, never production submissions.

## My Requests

Every signed-in member (including hosts) can use `/account/requests`. The account
dashboard shows the three most recent requests with a View all link. The existing
`/requests` route remains the host-only open-request board; booking inquiries stay
in Trips. Public member profiles never include private requests or responses.

- Selection is shareable through `/account/requests?requestId=DOCUMENT_ID`.
  Mobile shows either the list or a full-width response panel with Back to requests.
- Requests are queried with `requesterId == currentUser.uid`. All owned documents
  are loaded (no truncated totals); filters and location search operate on that
  complete result. Request ordering is local so legacy documents without
  `createdAt` are not silently excluded. Refresh reloads requests and counts.
- Response counts use owner-and-request-scoped Firestore aggregate queries.
  Selected responses use the same constraints. Counts are response totals, not
  unread counts; responses are not reservations. Data is a snapshot, not a live
  listener.
- Response normalization follows the current and original response writers:
  `cityLocation`, `stateRegion`, `rvSpotsCount`/`rvSpotsOffered` (including `5+`),
  `powerOption`, and explicit amenity booleans. Missing values are omitted or
  shown as unknown. Generic older opportunities without verified request/owner
  linkage are intentionally not matched by city or exposed as linked responses.
- Native disclosures expand host details. Only a valid host-provided email enables
  `mailto:` links. Public-profile lookup failures never block authorized responses.
- Continuing `/request-spot?requestId=DOCUMENT_ID` loads an owned editable draft.
  Saving rechecks owner/status in a transaction and updates the same document;
  finalized requests cannot be edited. Finalization still writes contact information
  only to `spotRequestPrivate`, not the host-visible projection.

### Validation and deployment

Run `npx tsc --noEmit`, ESLint on changed source files, `npm run build`, and
`npm run test:rules`. The rules script uses only the `demo-rvnb-rules-test`
emulator project. Never point rules tests at a production project.

Deployment order (not performed automatically):

1. Deploy [Firestore indexes](firestore.indexes.json) and wait for the
   `hostOpportunities(requesterId, requestId)` index to become ready.
2. Deploy [Firestore rules](firestore.rules), including owner-scoped `spotRequests`
   list permission. No other read boundaries are broadened.
3. Release the application after both dependencies are ready.

At high account volumes, replace full owner reads and per-request aggregate counts
with coordinated pagination/server totals before imposing any client-side limits.
No lifecycle, payment, messaging, notification, or booking-conversion behavior is
introduced by this feature.

## Listing ratings and map indicators

The listing-detail header and Ratings & reviews section share one server-confirmed
query for this listing's published `traveler_to_host` reviews. The average and count
include the complete query result, not just the latest 20 reviews displayed below.
Loading, failures with retry, and a genuine empty result are separate states.
Existing completed-stay review eligibility and write rules are unchanged.

Public Listings cards batch up to 30 listing IDs per query, with two batches in
flight per result set. Each query reads at most 501 matching published traveler
reviews: 500 plus an overflow sentinel. Only complete batches are summarized.
An overflowing batch displays **Ratings unavailable**, never a partial average
or a false **No reviews yet**. For higher review volumes, deploy trusted
per-listing backend rollups before replacing this bounded fallback. Firestore's
client aggregate queries do not group averages by listing ID; using them per card
would introduce the per-card query fan-out this implementation avoids.

Only finite numeric `lat` / `lng` values in geographic range are accepted; zero
is valid. These are the formats written by the existing listing form. A saved pin
is host-selected, not verified. Listings cards have separate, keyboard-accessible
listing links and View on map buttons, which focus the full-width map and open
the corresponding existing pin preview. No new location fields are exposed.

### Validation and release dependency

- Run `node --test listing-ratings.test.js listing-photos.test.js` for mocked
  rating, coordinate, map, card, detail, and photo regressions.
- For actual query permissions, run
  `npx firebase emulators:exec --only firestore --project demo-rvnb-rules-test "node --test --test-concurrency=1 listing-ratings.test.js firestore.rules.test.js"`.
  Without an emulator, the one query-permissions test is explicitly skipped.
- Before an approved application release, deploy the narrow
  `reviews(listingId, direction, status)` index in
  [firestore.indexes.json](firestore.indexes.json), alongside the existing detail
  index with `createdAt DESC`, and wait for readiness. No new rules or review-write
  permissions are required. Nothing here automatically deploys.

Search, featured previews, and member/account rating widgets are outside this
Listings-card addition. In particular, existing member/account summaries that
use recent-review subsets are not changed by this listing-specific implementation.

## Unique Stays

`/unique-stays` discovers stationary host-provided RVs, mobile homes, and cabins
in the existing listing system. Shared host controls, declared amenities,
listing-specific ratings, photos, maps, and typed guest inquiries are documented
in [Unique Stays](docs/unique-stays.md), including canonical values, legacy
compatibility, nightly-only estimates, tests, limitations, and rules-first
release prerequisites. Weekly/monthly totals require host confirmation; no
payments or automatic reservations are introduced.
