# Unique Stays (local implementation, pending approval)

Unique Stays extends the existing public `listings` collection, photo paths,
listing pages, reviews, maps, and pending booking inquiries. There is no second
inventory collection, production seed, payment integration, automatic reservation,
or new review-submission mechanism.

## Model and compatibility

The canonical values and TypeScript types live in
[listing-types.ts](../src/lib/listing-types.ts):

| `listingType` | Meaning |
| --- | --- |
| `rv_space` | Guest brings their own RV |
| `land_space` | Existing land/space offering |
| `host_rv` | Stationary host-provided RV accommodation |
| `mobile_home` | Mobile-home accommodation |
| `cabin` | Cabin accommodation |

One listing represents one independently bookable space or accommodation and
continues to use that listing's existing availability calendar. Accommodation
guests may not drive, tow, or remove the unit.

Missing or unrecognized types are **not** converted into accommodation. They
retain their stored value, remain in ordinary discovery, and display as legacy
RV/land spaces. Editing can keep the legacy type without a migration. Selecting
a canonical type opts into its validation. No batch migration is included.

Accommodation listings use an `accommodation` map:

- `maxGuests`: integer 1-30; unknown capacity never passes a guest filter.
- `bedrooms`: integer 0-20 (zero is a studio); `sleepingAreas`: integer 1-20.
- `beds`: six counts (`single`, `double`, `queen`, `king`, `bunk`, `sofa`),
  each integer 0-30, with at least one positive count. Bunk-bed counts do not
  imply a guest capacity.
- `bathrooms`: 0-20 in half-bath increments, representing bathrooms in the unit.
  Shared facilities are declared separately in amenities.
- Optional `checkInFrom`, `checkInTo`, `checkOutBy`: empty or 24-hour HH:mm.
  A declared check-in end cannot precede its start. Overnight arrangements need
  description rather than an invented time policy.
- `houseRules` up to 2,000 characters; `utilityNotes` up to 1,000;
  `accessNotes` up to 500.
- `rvType` up to 80 characters and `rvLengthFt` null or over 0 through 100.
  Both are required for `host_rv`; they remain dormant for other types.

Typed listings validate a title (1-200), city (1-120), two-character state,
description (up to 800, required for accommodation), finite price (0-1,000,000),
and `Night`, `Weekly`, or `Monthly` billing period.

Changing type does not delete stored fields. Incompatible rig/hookup controls
are hidden for accommodation, and accommodation/RV-specific values are retained
in form state. Edits use changed root fields and nested field patches, not
replacement of complete documents/maps. Ownership, photos, unrecognized keys,
and dormant data are not silently reset. An invalid/unrecognized canonical
accommodation map can cause a rules rejection rather than destructive
normalization; repairing imported invalid schema requires a separately reviewed
migration. Unknown legacy root values remain untouched when not edited.

## Shared amenities

[stay-amenities.ts](../src/lib/stay-amenities.ts) is the shared catalog for host
controls, public labels/icons, normalization, groups, and discovery filters.
[AccommodationFields](../src/app/components/AccommodationFields.tsx) and
[StayAmenities](../src/app/components/StayAmenities.tsx) consume this catalog;
there are not separate, competing filter/display definitions.

The 30 keys are grouped as follows:

- **Comfort:** `wifi`, `heating`, `airConditioning`, `linens`, `towels`, `laundry`.
- **Kitchen & bathroom:** `fullKitchen`, `kitchenette`, `refrigerator`,
  `microwave`, `cooktop`, `oven`, `bathroom`, `shower`, `hotWater`.
- **Outdoors & access:** `parking`, `outdoorSeating`, `picnicTable`, `grill`,
  `firePit`, `porchDeck`, `petsAllowed`, `stepFreeEntrance`.
- **RV utilities** (host-RV controls/display only): `connectedPower`,
  `potableWater`, `sewerConnection`, `holdingTank`.
- **Host safety declarations:** `smokeAlarm`, `coAlarm`, `fireExtinguisher`.

Each optional `stayAmenities` value is one of `unknown`, `available`, `private`,
`shared`, `unavailable`, or `not_applicable`. Missing/invalid values display as
not provided, not "No." Private/in-unit and shared arrangements are explicit.
Only available/private/shared match ordinary amenity filters; private-only
filters require the actual `private` state. Unknown, unavailable, and
not-applicable never match. Dormant RV-utility declarations retained after a
change to cabin/mobile-home type do not match RV-utility filters either.

Canonical declarations take precedence over older fields, including when the
explicit canonical declaration is unknown. Verified fallback is limited to
meaning-equivalent root booleans (`wifi`, `petsAllowed`, `firePit`,
`picnicTable`, `bathrooms`, `showers`) and the existing exact laundry values.
Full/partial hookups, power ratings, water/sewer strings, and rig capacity do
not prove connected utilities, potable water, accessibility, or safety.

For compatibility, known canonical states project the corresponding six legacy
booleans when saved. Unknown/not-applicable states do not invent `false` values
or erase older root data. Current accommodation readers use the canonical map
first; retained root values are not an independent source of confirmation.
Older clients do not understand this model and must not be used to manage
accommodation listings after release.

Safety declarations are host-provided, not RVNB inspections/certification.
Access descriptions do not establish accessibility compliance. Pets are subject
to the actual declaration and house rules.

## Discovery and existing surfaces

`/unique-stays` queries public listings with
`where("listingType", "in", ["host_rv", "mobile_home", "cabin"])`.
Ordinary RV/land spaces never enter that result. All matching public listing
documents are loaded, with local location/capacity/amenity filtering, so counts
describe the complete loaded query rather than a truncated page. This is
suitable for initial inventory; coordinated pagination/server-side filtering
will be needed before imposing limits at larger scale.

The native GET filter form and category links preserve `q`, `guests`, `type`,
repeated `amenity`, and `private` URL parameters. Refresh and browser history
restore filters. Invalid parameters do not become confirmed facts.

Main Listings, Search, featured previews, and details retain their existing
layouts and inventory. Accommodation labels/capacity replace irrelevant rig
claims; explicit RV-rig/hookup requirements do not match dormant accommodation
fields. Older exact laundry-service filters cannot infer Washer/Dryer or
Wash & Fold from a generic accommodation laundry-access declaration; use the
Unique Stays amenity filter instead. The full-width Listings map and independent card map/listing actions
remain. Finite, in-range coordinates accept zero; no coordinates are fabricated.
Incomplete accommodation rates/capacities/bed information have honest fallbacks.

Ratings use the shared bounded card loader: batches of 30 listing IDs, two
queries in flight, 500 matching published traveler-to-host reviews plus an
overflow sentinel per batch. Overflow/query errors yield unavailable ratings,
never partial averages or invented zero counts. Listing details retain their
single complete published-listing-review query shared by header and section.
Trusted backend rollups remain the scale dependency for large review volumes.

The homepage introduction is added after featured discovery without removing
existing sections. The existing hub navigation plus Search/Listings links
provide entry points without adding a crowded mobile header.

## Pricing and inquiries

The explicit supported estimate policy is:

1. `Night`: actual listed rate times validated calendar nights, rounded to cents.
   Date parsing rejects invalid calendar dates and avoids DST-based extra nights.
2. `Weekly` / `Monthly`: show the real rate and period; store `estimatedTotal:
   null`, `estimateStatus: "host_confirmation_required"`, and display
   **Total to be confirmed by host**. No nightly multiplication, prorating,
   invented minimum stays, or business-policy guess is applied.
3. Missing/invalid accommodation rates or periods disable the detail inquiry
   action until the host supplies them.

No automatic RV surcharge remains. Canonical listings offer only their declared
type. The existing booking enum is retained for downstream compatibility:
`rv_space` -> `RV`, `land_space` -> `LAND`, accommodation -> `RV_PROVIDED`.
The separate canonical `listingType` is mandatory on typed inquiries and
distinguishes cabins/mobile homes from host RVs. Untyped legacy inquiries retain
the existing RV/LAND choices, not an invented host-provided accommodation.

Accommodation inquiries record an integer `guestCount` within the listing's
current declared maximum. The client rechecks current owner, offering, capacity,
rate, and billing period immediately before writing, and prevents simultaneous
submissions. Firestore independently validates owner linkage, signed-in guest,
offering, guest capacity, allowed inquiry keys, numeric boundaries, date order,
note length, and server timestamp. Nightly estimates are bounded numbers;
weekly/monthly estimates must be null. These estimates are not authoritative
charges and do not reserve dates.

Host request cards and traveler Trips display the recorded type/guest count.
The existing calendar day inspector also shows the recorded type/guest count;
cabin/mobile-home chips no longer inherit the RV icon.
Host request cards preserve unpriced totals as unknown instead of $0. Existing
analytics still include booking estimates rather than settled payments; unpriced
totals contribute no amount, and the revenue-summary notice says so explicitly.
Existing approval, availability, completed-stay review eligibility, and lifecycle
behavior are unchanged.

## Backend boundaries and release order

[Firestore rules](../firestore.rules) add canonical listing/amenity/accommodation
and inquiry validation without changing public listing reads or earlier private
request/profile/review/Host Growth boundaries. Listing ownership stays immutable.
Existing untyped listings deliberately retain their older write compatibility;
this is not a general listing-schema rewrite.

Photo upload and cleanup reuse existing owner-protected Storage paths. No
Storage-rule changes are required by accommodation. No new composite index is
needed: the listing-type query uses Firestore's automatic single-field index.
Existing listing-review indexes remain required.

After explicit approval, release in this order (nothing deployed by this task):

1. Review the entire locally modified rules/index files alongside the preserved
   earlier features. Ensure existing review composite indexes are deployed and
   ready and that `listingType` has no disabled single-field indexing override.
2. Deploy the reviewed Firestore rules **before** enabling new typed listing/
   inquiry clients. Keep Host Growth intake closed as currently implemented.
3. Ensure the earlier photo-upload Storage rules are deployed if not already
   approved/released; this task does not alter those rules.
4. Release the reviewed application. No data migration or production fixtures
   are needed. Do not deploy mock preview helpers.

### Separate pre-existing findings (not broadened/fixed here)

- Untyped listing writes have a permissive legacy schema. A future migration
  should scope allowed root fields without discarding historical records.
- Existing listing delete permission references `request.resource.data` on
  deletes and may deny legitimate owner deletion. This implementation does not
  add deletion behavior or silently rewrite that boundary.
- Legacy booking payload validation remains looser than the new typed branch.
  Client estimates must never be treated as payment/settlement authority.
- Existing legacy RV-space hookup contradictions and older member-rating
  subset summaries are outside this feature. Neither is used to infer
  accommodation amenities or listing-specific ratings.

## Validation and remaining limitations

Executed locally:

- `npx tsc --noEmit`: passed.
- Changed-file ESLint: zero errors; three existing `<img>` warnings (one account
  logo and two calendar images).
- Default `npm run build` (Turbopack): passed; 33 static pages generated.
- Combined Firestore/Storage demo-emulator suite: **139 passed, zero failures,
  zero skips**, including earlier rules, Host Growth, ratings, photos, and
  Unique Stays contracts.

Reproduce the combined suite from the repository root:

```powershell
npx firebase emulators:exec --only firestore,storage --project demo-rvnb-listing-photos "node --test --test-concurrency=1 firestore.rules.test.js host-growth.test.js listing-ratings.test.js listing-photos.test.js unique-stays.test.js storage.rules.test.js"
```

Tests use only demo namespaces. New tests cover canonical/legacy normalization,
each accommodation type, studio/beds/capacity boundaries, malformed schemas,
type changes/nested preservation, unknown/private/shared amenity matching,
filter URL parsing, actual workspace loading/error/retry/empty logic, actual
form/inquiry handlers and duplicate locking, unsupported-total fallbacks,
ownership/auth/cross-user denial, mismatched offerings, immutable ownership,
and typed accommodation photo/reference-safe cleanup. Prior rating/map/photo
regressions run in the same suite.

Browser checks use the real public empty-inventory page and visibly marked,
read-only local SSR fixtures for populated cards, accommodation controls, and
detail content. No horizontal overflow was detected at 1440, 768, 390, or 320px;
labels, native keyboard controls, URL navigation, and disclosure layout were
inspected. Screenshots are delivered as session artifacts, not inventory.

Authenticated create/edit/upload/inquiry end-to-end browser writes were **not**
performed. Their handlers and backend boundaries are exercised by mock/emulator
tests, not claimed as live-account verification. Static fixture form controls
do not simulate hydration, saving, or the map SDK. The prior actual map
activation/keyboard tests remain in the regression suite.

No production writes, deployments, commits, staging, pushes, merges, billing
changes, or funding commitments are part of this implementation.

## Feature file inventory

New files:

- Model/catalog/filter helpers:
  [listing-types.ts](../src/lib/listing-types.ts),
  [stay-amenities.ts](../src/lib/stay-amenities.ts),
  [unique-stays.ts](../src/lib/unique-stays.ts).
- Discovery:
  [page.tsx](../src/app/unique-stays/page.tsx),
  [workspace.tsx](../src/app/unique-stays/workspace.tsx),
  [uniqueStays.module.css](../src/app/unique-stays/uniqueStays.module.css).
- Shared accommodation UI:
  [AccommodationFields.tsx](../src/app/components/AccommodationFields.tsx),
  [AccommodationDetails.tsx](../src/app/components/AccommodationDetails.tsx),
  [StayAmenities.tsx](../src/app/components/StayAmenities.tsx),
  [stayFields.module.css](../src/app/components/stayFields.module.css).
- Shared rating hook and homepage entry:
  [useListingRatings.ts](../src/app/components/useListingRatings.ts),
  [UniqueStaysIntro.tsx](../src/app/components/UniqueStaysIntro.tsx).
- [Unique Stays tests](../unique-stays.test.js) and this document.

Existing files extended (including files already modified by earlier work):

- Host creation/edit:
  [HostListingForm.tsx](../src/app/components/HostListingForm.tsx),
  [edit page](../src/app/host/listings/[id]/edit/page.tsx).
- Discovery/card/map integrations:
  [Listings page](../src/app/listings/page.tsx),
  [ListingsResults.tsx](../src/app/components/ListingsResults.tsx),
  [ListingsMapPanel.tsx](../src/app/components/ListingsMapPanel.tsx),
  [Search page](../src/app/search/page.tsx),
  [featuredlistingspreview.tsx](../src/app/components/featuredlistingspreview.tsx).
- Approved detail/inquiry surfaces:
  [listing detail](../src/app/listings/[id]/page.tsx),
  [bookingpaneltemp.tsx](../src/app/listings/[id]/bookingpaneltemp.tsx).
- Entry points:
  [homepage](../src/app/page.tsx),
  [ecosystemnav.tsx](../src/app/components/ecosystemnav.tsx).
- Downstream type/count/unknown-estimate display:
  [host dashboard](../src/app/host/page.tsx),
  [host calendar](../src/app/host/calendar/page.tsx),
  [HostBookingRequestsPanel.tsx](../src/app/components/HostBookingRequestsPanel.tsx),
  [hostDashboardUtils.ts](../src/app/components/hostDashboardUtils.ts),
  [HostRevenueSummary.tsx](../src/app/components/HostRevenueSummary.tsx),
  [account dashboard](../src/app/account/page.tsx),
  [AccountTripsPanel.tsx](../src/app/account/components/AccountTripsPanel.tsx).
- [Firestore rules](../firestore.rules), [photo regression tests](../listing-photos.test.js),
  [rating regression tests](../listing-ratings.test.js),
  [Storage regression tests](../storage.rules.test.js), and [README](../README.md).

The create route, photo uploader/gallery, Storage rules, availability/approval
services, review writer/eligibility, and indexes reuse their existing
implementations; they do not need a parallel accommodation implementation.
