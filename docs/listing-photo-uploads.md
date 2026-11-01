# Listing photo uploads

## Schema and compatibility

`listings/{listingId}` keeps ordered URL strings in `photos`. The first URL is the
cover. After an explicit photo edit, `imageUrl` and `photoURL` are both set to
that same cover (or `""` for no photos). This maintains existing Search and other
legacy readers without conflicting covers.

`photoAssets` contains `{ path, url }` for managed Storage objects only;
`photoPaths` contains those exact paths for Storage deletion protection.
External/local legacy URLs remain in `photos` but never gain a managed path.
The editor merges and deduplicates `imageUrl`, `photoURL`, and `photos` in that
priority order. Saving unrelated details does not migrate or remove photo data.
An existing legacy collection over eight images must be reduced explicitly
before a photo change can be saved; it is never silently truncated.

Objects use `listingPhotos/{ownerUid}/{listingId}/{uuid-v4}.webp`. No contact
information or original filename is included in the path or custom metadata.
All listing images, including staged images, are public. Do not use this system
for identity documents, account attachments, or request data. Previously
downloaded public images cannot be recalled.

## Save sequence and failure recovery

1. Validate the existing listing form. For creation, allocate a document ID once
   per mounted form/account and save the listing details with `hostId` before
   uploading anything. Retries reuse that ID rather than creating duplicates.
   Edit saves preserve ownership and the existing amenity/location behavior.
2. Upload prepared files sequentially with progress. Successful uploads remain
   in editor state. Retry checks a known random object path before uploading:
   a completed upload with a lost completion/download-URL response is reused,
   never overwritten. A failed upload stops the photo commit; existing public
   photo references remain unchanged.
3. In a Firestore transaction, check actual ownership and compare all original
   photo fields with the current document. Reject concurrent photo edits rather
   than overwriting them. Commit ordered URLs, synchronized cover aliases, and
   managed paths together. A retry whose desired fields already exactly match
   the server confirms an earlier commit with a lost response without rewriting
   it. A detail save can succeed while photo saving fails;
   the UI reports that distinction and stays open for Save/retry.
4. Only after this commit succeeds, delete removed managed objects whose paths
   match this owner/listing and the generated UUID format. Never derive deletion
   paths from URLs. Storage also refuses deletion while a path is referenced in
   `photoPaths`. Report cleanup failures separately from a successful photo save.

No Storage/Firestore atomic transaction exists. Uploads can be left unreferenced
if the tab closes after upload, the user removes a staged successful upload
before retry, permissions change, or a concurrent-edit conflict forces reload.
Successful uploads remain retryable while the editor stays open; browser unload
warnings reduce accidental loss. The implementation deliberately does not delete
on uncertain commit/network failure or unmount. There is no automatic orphan
collector in this change. An approved administrative cleanup must inspect actual
current listing references before deleting old, unreferenced managed objects.
Cleanup failures can leave removed images publicly reachable at their old URLs.

## Validation and rules

The client accepts JPEG, PNG, and WebP up to 5 MiB, checks file signatures and
header dimensions (up to 24 megapixels / 12,000 pixels per axis), decodes, resizes
to at most 2,400 pixels on the longest side, and re-encodes WebP without original
EXIF/filename metadata. HEIC, GIF, SVG, damaged files, and MIME mismatches show
actionable errors. Unsupported browser decoding/encoding also reports an error.

Client checks are usability protection, not a security boundary. Storage rules
enforce authenticated UID/path matching, actual Firestore listing ownership,
random-path format, nonempty content up to 5 MiB, WebP metadata type, no arbitrary
custom metadata, immutable existing objects, and safe deletion of referenced
paths. Clients accept three input formats; Storage accepts only their prepared
WebP output. Rules cannot inspect image bytes/dimensions or globally count objects;
the eight-photo limit is enforced by the application, not a bucket quota.
A trusted image-processing service would be needed for adversarial byte-level
validation, malware scanning, or strict server-enforced decoded-dimension limits.

Public `get` is allowed only under the listing-photo prefix; object listing and
all other paths are denied. No pre-existing repository Storage rules/config were
found. **The deployed Storage rules were not inspected.** Before deployment,
compare them and merge this prefix policy without removing unrelated permissions.
No Firestore rule or index change is required by the existing listing-write
permissions, and none is included here.

## Configuration and deployment (separate approval required)

- A nonempty `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` is present locally. This is
  configuration only: bucket provisioning, deployed policies, production access,
  actual billing plan, and CORS have not been verified.
- Firebase's current [Storage billing FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
  states that Cloud Storage for Firebase requires the Blaze plan. No billing,
  service enablement, or production configuration was changed.
- Review/merge the additive `storage` and Storage-emulator entries in
  `firebase.json` with Grok's configuration package. `src/lib/firebase.ts` is
  unchanged: the photo service lazily obtains Storage from the already initialized
  Firebase app.
- The shared account-page integration is isolated to a photo-helper import, the
  listing type's photo fields, and `photos: listingPhotos(l)` in the card mapping.
  The public member page similarly adds photo imports/type fields and replaces
  only its existing listing-photo placeholder; profile visibility and data
  loading are untouched. Preserve all existing account/request/profile changes
  when integrating.
- After separate approval, verify/provision the intended bucket and billing,
  preserve deployed unrelated Storage permissions, and deploy the Storage rules
  **before** shipping the upload UI. Cross-service Firestore access in Storage
  rules requires Firebase's Storage service-agent permission setup; review the
  Firebase CLI prompt in the approved deployment. No Firestore rules/index
  deployment is necessary for this feature.
- Rebuild the client if public Firebase environment settings change. Do not
  troubleshoot failed uploads with unrestricted writes.

## Local validation

Never use the locally configured non-demo project for test writes.

```powershell
node --test listing-photos.test.js
npx firebase emulators:exec --only firestore,storage --project demo-rvnb-listing-photos "node --test storage.rules.test.js"
```

The mocked tests cover schema compatibility, header validation, cover/removal,
reload, upload/commit failures, retries without reupload, concurrency, duplicate
submit protection, and cleanup reporting. Rules tests cover public get, denied
listing, owner versus cross-user/anonymous writes/deletes, MIME/size/path/metadata,
immutable replacement, referenced-object protection, and Firestore ownership.
The emulator suite uses unique paths per case to avoid cached object responses.
