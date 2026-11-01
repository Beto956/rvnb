/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { doc, setDoc, updateDoc } = require("firebase/firestore");
const { ref, uploadBytes, deleteObject, getBytes, listAll } = require("firebase/storage");

const projectId = "demo-rvnb-listing-photos";
let file;
let path;
const bytes = new Uint8Array([82, 73, 70, 70]);
let env;
function storage(uid) { return (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage(); }
function upload(uid, target = path, data = bytes, metadata = { contentType: "image/webp" }) {
  return uploadBytes(ref(storage(uid), target), data, metadata);
}
async function seed(data = {}) {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "listings/listing"), { hostId: "owner", ...data });
  });
}
test.before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST, "Use both demo emulators only");
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});
test.beforeEach(async () => {
  file = `${randomUUID()}.webp`;
  path = `listingPhotos/owner/listing/${file}`;
  await env.clearStorage(); await env.clearFirestore(); await seed();
});
test.after(async () => { if (env) await env.cleanup(); });

test("actual owner can upload; public get allowed; public listing denied", async () => {
  await assertSucceeds(upload("owner"));
  assert.equal((await assertSucceeds(getBytes(ref(storage(null), path)))).byteLength, bytes.length);
  await assertFails(listAll(ref(storage(null), "listingPhotos/owner/listing")));
});
test("other user, anonymous, forged owner path, and missing listing denied", async () => {
  await assertFails(upload("other"));
  await assertFails(upload(null));
  await assertFails(upload("owner", path.replace("/owner/", "/other/")));
  await assertFails(upload("owner", path.replace("/listing/", "/missing/")));
  await assertFails(upload("owner", `unrelated/${file}`));
});
test("size, type, filename, nested path and metadata checks enforced", async () => {
  await assertFails(upload("owner", path, new Uint8Array(5 * 1024 * 1024 + 1)));
  await assertFails(upload("owner", path, new Uint8Array(0)));
  for (const contentType of ["image/svg+xml", "image/gif", "text/html", "image/jpeg", "image/png"]) {
    await assertFails(upload("owner", path, bytes, { contentType }));
  }
  await assertFails(upload("owner", path.replace(file, "predictable.webp")));
  await assertFails(upload("owner", `${path}/child`));
  await assertFails(upload("owner", path, bytes, { contentType: "image/webp", customMetadata: { requesterEmail: "private@example.test" } }));
  await assertSucceeds(upload("owner", path, new Uint8Array(5 * 1024 * 1024)));
});
test("immutable object replacement denied; only owner can delete an unreferenced object", async () => {
  await assertSucceeds(upload("owner"));
  await assertFails(upload("owner", path, new Uint8Array([1, 2, 3, 4, 5])));
  await assertFails(deleteObject(ref(storage("other"), path)));
  await assertFails(deleteObject(ref(storage(null), path)));
  await assertSucceeds(deleteObject(ref(storage("owner"), path)));
});
test("saved photos cannot be deleted until listing update removes the reference", async () => {
  await assertSucceeds(upload("owner"));
  await seed({ photoPaths: [path] });
  await assertFails(deleteObject(ref(storage("owner"), path)));
  await seed({ photoPaths: [] });
  await assertSucceeds(deleteObject(ref(storage("owner"), path)));
});
test("Firestore immutable ownership remains enforced", async () => {
  const ownerDb = env.authenticatedContext("owner").firestore();
  await assertFails(updateDoc(doc(ownerDb, "listings/listing"), { hostId: "other" }));
});
test("typed accommodation reuses owner photo uploads and reference-safe cleanup", async () => {
  const ownerDb = env.authenticatedContext("owner").firestore();
  const listingRef = doc(ownerDb, "listings/listing");
  await assertSucceeds(setDoc(listingRef, {
    hostId: "owner", listingType: "cabin", title: "Demo cabin", city: "Austin", state: "TX",
    description: "Local emulator fixture only", price: 90, pricingType: "Night", stayAmenities: { wifi: "shared" },
    accommodation: {
      maxGuests: 2, bedrooms: 0, sleepingAreas: 1, bathrooms: 1,
      beds: { single: 0, double: 0, queen: 1, king: 0, bunk: 0, sofa: 0 },
      checkInFrom: "", checkInTo: "", checkOutBy: "", houseRules: "", rvType: "", rvLengthFt: null,
      utilityNotes: "", accessNotes: "",
    },
  }));
  await assertSucceeds(upload("owner"));
  await assertFails(upload("other"));
  await assertSucceeds(updateDoc(listingRef, { photos: ["https://example.test/demo.webp"], photoPaths: [path] }));
  await assertFails(deleteObject(ref(storage("owner"), path)));
  await assertSucceeds(updateDoc(listingRef, { photos: [], photoPaths: [] }));
  await assertSucceeds(deleteObject(ref(storage("owner"), path)));
});
